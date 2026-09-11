// Version 3 draws directly into each slot using BSL tables. Version 2 receipts
// remain final: upgrading must never refill already claimed rewards.
export const REWARD_VERSION = 3;
export function inventoryHasItems(container) {
    for (let i = 0; i < container.size; i++) if (container.getItem(i)) return true;
    return false;
}
export function deliverRoomReward(room, container, { insert, persist, random = Math.random }) {
    if (room.debug || (!room.unlockComplete && room.kind !== "treasure_vault")) return false;
    if (!container) return false;
    if (container.size !== 27) throw new Error("reward chest merged with unrelated inventory");
    const occupied = inventoryHasItems(container);
    if (room.rewardVersion !== REWARD_VERSION) {
        if ((room.rewardVersion ?? 0) < 2 && ["stocking", "stocked"].includes(room.reward)) {
            room.reward = occupied ? "stocked" : "locked";
        }
        room.rewardVersion = REWARD_VERSION;
        persist();
    }
    if (room.reward === "stocked") return true;
    if (!["locked", "stocking"].includes(room.reward)) return false;
    if (!room.rewardDraw) {
        // Reconcile an interrupted old whole-chest insert without duplicating it.
        if (room.reward === "stocking" && occupied) {
            room.reward = "stocked";
            persist();
            return true;
        }
        if (occupied) throw new Error("unclaimed reward chest already contains items");
        room.rewardDraw = { anchor: Math.min(26, Math.max(0, Math.floor(random() * 27))), next: 0 };
        room.reward = "stocking";
        persist();
    }
    const draw = room.rewardDraw;
    const slotFor = index => index === 0 ? draw.anchor : (index - 1 < draw.anchor ? index - 1 : index);
    // A persisted pending slot means the process stopped around a native command.
    // Never reroll an ambiguous empty outcome. The guaranteed slot can be retried
    // only when empty, since its table cannot legitimately select empty.
    if (draw.pending !== undefined) {
        if (draw.pending !== 0 || container.getItem(draw.anchor)) draw.next = draw.pending + 1;
        delete draw.pending;
        persist();
    }
    while (draw.next < 27) {
        const index = draw.next, slot = slotFor(index);
        if (container.getItem(slot)) throw new Error("undrawn reward slot already contains items");
        draw.pending = index;
        persist();
        try {
            insert(slot, index === 0);
            if (index === 0 && !container.getItem(slot)) throw new Error("guaranteed BSL draw inserted no items");
        } catch (error) {
            // A write followed by an exception is already delivered. Resume at
            // the next slot; a command which failed before writing is retryable.
            if (container.getItem(slot)) draw.next++;
            delete draw.pending;
            room.rewardError = String(error?.message ?? error);
            persist();
            throw error;
        }
        draw.next++;
        delete draw.pending;
        persist();
    }
    room.reward = "stocked";
    delete room.rewardError;
    persist();
    return true;
}
