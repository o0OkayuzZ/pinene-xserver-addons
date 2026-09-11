import { roomContains, roomInterior } from "./sourceRoomEncounterConfig.js";

export const HEALING_GARDEN = Object.freeze({
    variantId: "castle_part_002_up_r3",
    intervalTicks: 40,
    healthPerPulse: 2,
});

export function isHealingGarden(placement) {
    return placement.materialTheme === "rare"
        && (placement.rareRoomType ?? "healing_garden") === "healing_garden"
        && placement.category === "room"
        && placement.variantId === HEALING_GARDEN.variantId;
}

// Direct health changes leave no regeneration effect behind on exit. Cooldowns
// survive stepping across the boundary, so re-entry cannot accelerate healing.
export function createGardenHealing() {
    const nextPulse = new Map();
    const entered = new Map();
    return (players, rooms, tick) => {
        const present = new Set(players.map(p => p.id));
        for (const id of nextPulse.keys()) if (!present.has(id)) nextPulse.delete(id);
        for (const id of entered.keys()) if (!present.has(id)) entered.delete(id);
        for (const player of players) {
            const mode = String(player.getGameMode()).toLowerCase();
            const garden = ["survival", "adventure"].includes(mode)
                ? rooms.find(r => !r.retired && r.kind === "healing_garden"
                    && roomContains(roomInterior(r.origin, true), player.location)) : null;
            if (!garden) { entered.delete(player.id); continue; }
            if (entered.get(player.id) !== garden.key) {
                entered.set(player.id, garden.key);
                player.sendMessage("§b[癒やしの庭] §rこの庭では、2秒ごとにハート1個分回復します。");
            }
            if (!nextPulse.has(player.id)) nextPulse.set(player.id, tick + HEALING_GARDEN.intervalTicks);
            if (tick < nextPulse.get(player.id)) continue;
            nextPulse.set(player.id, tick + HEALING_GARDEN.intervalTicks);
            const health = player.getComponent("minecraft:health");
            if (health && health.currentValue > 0 && health.currentValue < health.effectiveMax) {
                health.setCurrentValue(Math.min(health.effectiveMax, health.currentValue + HEALING_GARDEN.healthPerPulse));
            }
        }
    };
}
