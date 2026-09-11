import { createSourcePartsDemoProgression } from "./sourcePartsDemoProgression.js";
import { isHealingGarden } from "./sourceHealingGarden.js";

// Provisional rarity, independent of ordinary reward chests and combat logic.
export const RARE_ROOM_CHANCE = 0.05;
export const ROOM_MATERIAL_BLOCKS = Object.freeze({
    normal: "minecraft:stripped_spruce_log",
    boss: "minecraft:crimson_stem",
    rare: "minecraft:warped_stem",
});

function rarityRoll(seed, id) {
    let hash = (seed ^ 0x72617265) >>> 0;
    for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);
    return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

export function assignRoomMaterials(plan) {
    const rooms = createSourcePartsDemoProgression(plan.seed, plan).rooms;
    const roles = new Map(rooms.map(room => [room.placementId, room.role]));
    for (const placement of plan.placements) {
        if (placement.category !== "room") continue;
        const role = roles.get(placement.placementId);
        placement.materialTheme = role === "miniboss" || role === "final" ? "boss"
            : role === "reward" && rarityRoll(plan.seed, placement.placementId) < RARE_ROOM_CHANCE
                ? "rare" : "normal";
        placement.rareRoomType = placement.materialTheme === "rare"
            ? (rarityRoll(plan.seed ^ 0x7661756c, placement.placementId) < 0.5 ? "healing_garden" : "treasure_vault")
            : undefined;
    }
    return plan;
}

export function materialVariantId(placement) {
    const theme = placement.materialTheme ?? "normal";
    if (!Object.hasOwn(ROOM_MATERIAL_BLOCKS, theme)) throw new Error(`invalid room material: ${theme}`);
    if (placement.category !== "room" || theme === "normal") return placement.variantId;
    if (isHealingGarden(placement)) return `${placement.variantId}_rare_garden`;
    if (theme === "rare" && placement.rareRoomType === "treasure_vault") return `${placement.variantId}_rare_vault`;
    return `${placement.variantId}_${theme}`;
}

export function serializeRoomMaterials(plan) {
    return plan.placements.filter(p => p.category === "room")
        .map(p => p.materialTheme === "rare"
            ? [p.placementId, "rare", p.rareRoomType ?? "healing_garden"]
            : [p.placementId, p.materialTheme ?? "normal"]);
}

export function restoreRoomMaterials(plan, saved) {
    // Descriptors written before this feature represent the original spruce rooms.
    const entries = saved ?? [];
    if (!Array.isArray(entries)) throw new Error("invalid saved room materials");
    const byId = new Map();
    const roomIds = new Set(plan.placements.filter(p => p.category === "room").map(p => p.placementId));
    for (const entry of entries) {
        if (!Array.isArray(entry) || ![2, 3].includes(entry.length) || !roomIds.has(entry[0])
            || !Object.hasOwn(ROOM_MATERIAL_BLOCKS, entry[1]) || byId.has(entry[0])) {
            throw new Error("invalid saved room material entry");
        }
        if (entry.length === 3 && (entry[1] !== "rare" || !["healing_garden", "treasure_vault"].includes(entry[2]))) {
            throw new Error("invalid saved rare room type");
        }
        byId.set(entry[0], entry);
    }
    for (const placement of plan.placements) {
        if (placement.category !== "room") continue;
        const entry = byId.get(placement.placementId);
        placement.materialTheme = entry?.[1] ?? "normal";
        // All previously saved rare rooms were gardens. Never reroll them.
        placement.rareRoomType = placement.materialTheme === "rare" ? entry?.[2] ?? "healing_garden" : undefined;
    }
    return plan;
}
