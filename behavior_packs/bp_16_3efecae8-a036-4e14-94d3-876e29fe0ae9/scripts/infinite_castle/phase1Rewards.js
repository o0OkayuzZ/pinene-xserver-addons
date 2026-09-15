// Version 3 draws directly into each slot using BSL tables. Version 2 receipts
// remain final: upgrading must never refill already claimed rewards.
export const REWARD_VERSION = 3;
export function inventoryHasItems(container) {
    for (let i = 0; i < container.size; i++) if (container.getItem(i)) return true;
    return false;
}
export function deliverLegacyRoomReward(room, container, { insert, persist, random = Math.random }) {
    if (room.debug || (!room.unlockComplete && room.kind !== "treasure_vault")) return false;
    if (!container) return false;
    if (container.size !== 27) throw new Error("reward chest merged with unrelated inventory");
    const occupied = inventoryHasItems(container);
    if (room.rewardVersion !== REWARD_VERSION) {
        // Retain the historical V1 empty-receipt repair. Never infer successful
        // stocking from unrelated contents in an unfinished receipt.
        if ((room.rewardVersion ?? 0) < 2 && room.reward === "stocked" && !occupied) room.reward = "locked";
        room.rewardVersion = REWARD_VERSION;
        persist();
    }
    if (room.reward === "stocked") return true;
    if (!["locked", "stocking"].includes(room.reward)) return false;
    if (!room.rewardDraw) {
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

export const CURRENT_REWARD_VERSION = 5;
export function assertOwnedRewardInventory(room, container) {
    if (container.size !== 27) throw new Error("reward chest merged with unrelated inventory");
    if (room.reward === "stocked") return;
    const draw = room.rewardDraw;
    const allowed = new Set();
    if (draw && [4, CURRENT_REWARD_VERSION].includes(room.rewardVersion) && Array.isArray(draw.selectedSlots)) {
        for (const slot of draw.selectedSlots.slice(0, draw.next)) allowed.add(slot);
        if (draw.pending === draw.next) allowed.add(draw.selectedSlots[draw.pending]);
    } else if (draw && room.rewardVersion === 3 && Number.isInteger(draw.anchor)) {
        const slotFor = i => i === 0 ? draw.anchor : i - 1 < draw.anchor ? i - 1 : i;
        for (let i = 0; i < draw.next; i++) allowed.add(slotFor(i));
        if (draw.pending === draw.next) allowed.add(slotFor(draw.pending));
    }
    for (let slot = 0; slot < container.size; slot++) {
        if (container.getItem(slot) && !allowed.has(slot))
            throw new Error("unclaimed reward chest already contains unexpected items");
    }
}
export function rewardSlotRange(room, version = CURRENT_REWARD_VERSION) {
    // Retain the original valid range for receipts already started under V4.
    if (room.kind === "treasure_vault") return version === 4 ? [23, 27] : [24, 27];
    if (room.encounterType === "elite") return version === 4 ? [19, 23] : [20, 24];
    return version === 4 ? [16, 20] : [17, 21];
}
export function selectRewardSlots(room, random = Math.random) {
    const [min, max] = rewardSlotRange(room);
    const roll = n => Math.min(n - 1, Math.max(0, Math.floor(random() * n)));
    const count = min + roll(max - min + 1);
    const slots = Array.from({ length: 27 }, (_, i) => i);
    for (let i = 26; i > 0; i--) {
        const j = roll(i + 1);
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    return slots.slice(0, count);
}
export function deliverRoomReward(room, container, api) {
    if (room.debug || (!room.unlockComplete && room.kind !== "treasure_vault")) return false;
    if (!container) return false;
    if (container.size !== 27) throw new Error("reward chest merged with unrelated inventory");
    // Never reinterpret partially delivered V3 draws using the V4 distribution.
    if (room.rewardVersion === 3 && room.reward === "stocking" && room.rewardDraw) {
        return deliverLegacyRoomReward(room, container, { ...api, insert: api.insertLegacy });
    }
    if (room.reward === "stocked") return true;
    if (!["locked", "stocking"].includes(room.reward)) return false;
    if (!room.rewardDraw || ![4, CURRENT_REWARD_VERSION].includes(room.rewardVersion)) {
        if (inventoryHasItems(container)) {
            throw new Error("unclaimed reward chest already contains items");
        }
        room.rewardDraw = { selectedSlots: selectRewardSlots(room, api.random), next: 0 };
        room.rewardVersion = CURRENT_REWARD_VERSION;
        room.reward = "stocking";
        api.persist();
    }
    const draw = room.rewardDraw;
    const [min, max] = rewardSlotRange(room, room.rewardVersion);
    if (!Array.isArray(draw.selectedSlots) || draw.selectedSlots.length < min || draw.selectedSlots.length > max
        || new Set(draw.selectedSlots).size !== draw.selectedSlots.length
        || draw.selectedSlots.some(s => !Number.isInteger(s) || s < 0 || s > 26)
        || !Number.isInteger(draw.next) || draw.next < 0 || draw.next > draw.selectedSlots.length)
        throw new Error("invalid V4 reward receipt; retained for recovery");
    const permitted = new Set(draw.selectedSlots.slice(0, draw.next));
    if (draw.pending !== undefined) permitted.add(draw.selectedSlots[draw.pending]);
    for (let slot = 0; slot < 27; slot++) {
        if (container.getItem(slot) && !permitted.has(slot))
            throw new Error("unexpected inventory outside delivered reward slots");
    }
    if (draw.pending !== undefined) {
        if (draw.pending !== draw.next || draw.pending >= draw.selectedSlots.length)
            throw new Error("invalid pending V4 reward receipt");
        // Unstocked owned chests are isolated. Only a confirmed native write
        // advances the receipt; an empty pending slot retries the same draw.
        if (container.getItem(draw.selectedSlots[draw.pending])) draw.next++;
        delete draw.pending;
        api.persist();
    }
    while (draw.next < draw.selectedSlots.length) {
        const slot = draw.selectedSlots[draw.next];
        if (container.getItem(slot)) throw new Error("undrawn reward slot already contains items");
        draw.pending = draw.next;
        api.persist();
        try {
            api.insert(slot);
            if (!container.getItem(slot)) throw new Error("non-empty BSL draw inserted no items");
        } catch (error) {
            if (container.getItem(slot)) draw.next++;
            delete draw.pending;
            room.rewardError = String(error?.message ?? error);
            api.persist();
            throw error;
        }
        draw.next++;
        delete draw.pending;
        api.persist();
    }
    room.reward = "stocked";
    delete room.rewardError;
    api.persist();
    return true;
}
