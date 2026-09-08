// Demo balance only; independent of the disabled legacy key/boss progression.
export const ROOM_ENCOUNTER_CONFIG = Object.freeze({
    dimensionId: "infinite_castle:dungeon",
    variantId: "castle_part_002_up_r3",
    updateTicks: 5,
    lightWritesPerUpdate: 24,
    maxLoadedEnemies: 45,
    missingEnemyGraceTicks: 600,
    enemies: Object.freeze([
        { typeId: "minecraft:zombie", name: "§6鍵持ちの番人", keyHolder: true },
        { typeId: "minecraft:zombie", name: "§7城の守兵", keyHolder: false },
        { typeId: "minecraft:skeleton", name: "§7城の弓兵", keyHolder: false },
    ]),
    loot: Object.freeze([
        { typeId: "minecraft:bread", amount: 6 },
        { typeId: "minecraft:arrow", amount: 12 },
        { typeId: "minecraft:iron_ingot", amount: 3 },
    ]),
});

export const ROOM_CHEST_CANDIDATES = Object.freeze([
    { x: 11, y: 1, z: 11 }, { x: 31, y: 1, z: 11 },
    { x: 11, y: 1, z: 31 }, { x: 31, y: 1, z: 31 },
]);
export const ROOM_SPAWN_CANDIDATES = Object.freeze([
    { x: 14, y: 1, z: 14 }, { x: 28, y: 1, z: 28 },
    { x: 28, y: 1, z: 14 }, { x: 14, y: 1, z: 28 },
]);
// Above three-block walking clearance, on all three interior storeys. Runtime
// skips authored solid blocks; the native-asset audit checks propagation too.
export const ROOM_LIGHT_CANDIDATES = Object.freeze(
    [4, 14, 23].flatMap(y => Array.from({ length: 7 }, (_, x) =>
        Array.from({ length: 7 }, (_, z) => ({ x: 9 + x * 4, y, z: 9 + z * 4 }))
    ).flat())
);

export function roomWorldPoint(origin, local) {
    return { x: origin.x + local.x, y: origin.y + local.y, z: origin.z + local.z };
}

export function roomIdentity(placement) {
    const o = placement.origin;
    return `${placement.variantId ?? placement.variant?.id}@${o.x},${o.y},${o.z}`;
}

export function roomInterior(origin, groundOnly = false) {
    return {
        from: roomWorldPoint(origin, { x: 6, y: 1, z: 6 }),
        to: roomWorldPoint(origin, { x: 36, y: groundOnly ? 9 : 29, z: 36 }),
    };
}

export function roomBoundsIntersect(a, b) {
    return ["x", "y", "z"].every(axis => a.from[axis] <= b.to[axis] && a.to[axis] >= b.from[axis]);
}

export function roomContains(bounds, point) {
    return ["x", "y", "z"].every(axis => point[axis] >= bounds.from[axis] && point[axis] < bounds.to[axis] + 1);
}
