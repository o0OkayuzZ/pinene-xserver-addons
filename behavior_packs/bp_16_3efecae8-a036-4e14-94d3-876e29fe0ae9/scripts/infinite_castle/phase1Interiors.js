import { roomWorldPoint, roomInterior, roomContains } from "./sourceRoomEncounterConfig.js";

// Compact one-shot overlays. Socket walls, walking approaches and external
// geometry remain authored by Source Parts. No per-tick block painter.
export function interiorBlocks(room) {
    const result = [],
        put = (x, y, z, id) =>
            result.push({ position: roomWorldPoint(room.origin, { x, y, z }), typeId: `minecraft:${id}` });
    const v = room.interiorVariant ?? 0;
    if (room.kind === "exit") {
        for (let x = 19; x <= 23; x++)
            for (let z = 19; z <= 23; z++)
                put(
                    x,
                    0,
                    z,
                    x === 19 || x === 23 || z === 19 || z === 23 ? "gold_block" : "polished_deepslate",
                );
        return result;
    }
    if (room.kind === "healing_garden") {
        for (let x = 14; x <= 28; x++)
            for (let z = 14; z <= 28; z++) {
                if (Math.abs(x - 21) <= 1 || Math.abs(z - 21) <= 1) {
                    put(x, 0, z, "stone");
                    continue;
                }
                put(x, 0, z, v === 0 && x < 19 && z < 19 ? "water" : "moss_block");
                if ((x + z) % 7 === 0)
                    put(
                        x,
                        1,
                        z,
                        v === 2
                            ? "flowering_azalea"
                            : v === 1
                              ? "stone"
                              : x % 2
                                ? "azalea"
                                : "flowering_azalea",
                    );
                if (v === 2 && (x + z) % 9 === 0) put(x, 1, z, "azalea_leaves");
            }
        for (const [x, z] of [
            [14, 14],
            [28, 14],
            [14, 28],
            [28, 28],
        ]) {
            put(x, 1, z, "spruce_log");
            put(x, 2, z, v === 2 ? "azalea_leaves" : "lantern");
        }
    }
    if (room.kind === "treasure_vault") {
        for (let x = 15; x <= 27; x++)
            for (let z = 15; z <= 27; z++) put(x, 0, z, (x + z) % 2 ? "polished_blackstone" : "gold_block");
        for (const [x, z] of [
            [15, 15],
            [27, 15],
            [15, 27],
            [27, 27],
        ])
            for (let dx = 0; dx < 3; dx++)
                for (let dz = 0; dz < 3; dz++) {
                    put(x + dx, 1, z + dz, "gold_block");
                    if (dx === 1 && dz === 1)
                        put(
                            x + dx,
                            2,
                            z + dz,
                            v === 1 ? (x < 20 ? "emerald_block" : "diamond_block") : "gold_block",
                        );
                }
        if (v === 1)
            for (let x = 15; x <= 29; x += 2) {
                put(x, 1, 32, "bookshelf");
                put(x, 2, 32, "chiseled_stone_bricks");
            }
    }
    return result;
}
export function decorateSpecialRoom(dimension, room) {
    const blocks = interiorBlocks(room);
    if (!blocks.length) return true;
    // Preflight the complete small overlay before writing anything. This is a
    // single initialization job; retries only occur for unloaded chunks.
    const resolved = blocks.map((b) => ({ b, block: dimension.getBlock(b.position) }));
    if (resolved.some((x) => !x.block)) return false;
    for (const { b, block } of resolved) {
        if (room.chest && ["x", "y", "z"].every((a) => b.position[a] === room.chest[a])) continue;
        block.setType(b.typeId);
    }
    return true;
}
export function decorationProtected(room, position, typeId) {
    if (room.retired || !["treasure_vault", "exit"].includes(room.kind)) return false;
    if (
        room.kind === "treasure_vault" &&
        ["minecraft:gold_block", "minecraft:diamond_block", "minecraft:emerald_block"].includes(typeId) &&
        roomContains(roomInterior(room.origin), position)
    )
        return true;
    return interiorBlocks(room).some((b) => ["x", "y", "z"].every((a) => b.position[a] === position[a]));
}
