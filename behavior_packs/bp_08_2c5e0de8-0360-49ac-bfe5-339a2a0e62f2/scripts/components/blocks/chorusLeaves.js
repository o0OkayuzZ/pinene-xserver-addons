import {
    system,
    BlockVolume,
    world
} from "@minecraft/server";
const logBlocks = [
    "minecraft:oak_log",
    "minecraft:oak_wood",
    "minecraft:stripped_oak_log",
    "minecraft:stripped_oak_wood",
    "minecraft:birch_log",
    "minecraft:birch_wood",
    "minecraft:stripped_birch_log",
    "minecraft:stripped_birch_wood",
    "minecraft:spruce_log",
    "minecraft:spruce_wood",
    "minecraft:stripped_spruce_log",
    "minecraft:stripped_spruce_wood",
    "minecraft:jungle_log",
    "minecraft:jungle_wood",
    "minecraft:stripped_jungle_log",
    "minecraft:stripped_jungle_wood",
    "minecraft:dark_oak_log",
    "minecraft:dark_oak_wood",
    "minecraft:stripped_dark_oak_log",
    "minecraft:stripped_dark_oak_wood",
    "minecraft:acacia_log",
    "minecraft:acacia_wood",
    "minecraft:stripped_acacia_log",
    "minecraft:stripped_acacia_wood",
    "minecraft:mangrove_log",
    "minecraft:mangrove_wood",
    "minecraft:stripped_mangrove_log",
    "minecraft:stripped_mangrove_wood",
    "minecraft:cherry_log",
    "minecraft:cherry_wood",
    "minecraft:stripped_cherry_log",
    "minecraft:stripped_cherry_wood",
    "minecraft:pale_oak_log",
    "minecraft:pale_oak_wood",
    "minecraft:stripped_pale_oak_log",
    "minecraft:stripped_pale_oak_wood",
    "minecraft:poplar_log",
    "minecraft:poplar_wood",
    "minecraft:stripped_poplar_log",
    "minecraft:stripped_poplar_wood",
    "minecraft:crimson_stem",
    "minecraft:crimson_hyphae",
    "minecraft:stripped_crimson_stem",
    "minecraft:stripped_crimson_hyphae",
    "minecraft:warped_stem",
    "minecraft:warped_hyphae",
    "minecraft:stripped_warped_stem",
    "minecraft:stripped_warped_hyphae"
]

function borderGenerating(dimensionId) {
    try {
        if (!dimensionId.includes("dungeons:ancientdim_")) return false;
        return world.getDynamicProperty("dungeons:generating_border_blocks") === true;
    } catch {
        return false;
    }
}

function isLeavesBlock(block) {
    if (block.hasTag("dungeons:custom_leaves")) return true;
    if (block.hasTag("mm:custom_leaves")) return true;
    if (block.typeId.includes("leaves")) return true;
    return false;
}
function isLog(block) {
    if (block.hasTag("mm:custom_log")) return true;
    if (logBlocks.includes(block.typeId)) return true;
    return false;
}

function tryOpaque(block, dim) {
    if (!block.getComponent("dungeons:custom_leaves")) return;
    const perm = block.permutation
    const opaque = perm.getState("dungeons:opaque")
    const checks = [
        block.above(),
        block.below(),
        block.east(),
        block.south(),
        block.west(),
        block.north()
    ]
    var makeOpaque = true
    for (const target of checks) {
        if (!target) continue;
        if (!dim.isChunkLoaded(target.location)) return
        if (target.typeId !== "minecraft:end_stone" && isLeavesBlock(target) == false && isLog(target) == false) makeOpaque = false
    }

    if (makeOpaque === opaque) return;

    const newPerm = perm.withState("dungeons:opaque", makeOpaque)
    block.setPermutation(newPerm)
}

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:custom_leaves", {
        onRandomTick(e) {
            if (borderGenerating(e.dimension.id)) return;
            const block = e.block;
            const dim = e.dimension;
            const radius = 4;
            const perm = block.permutation

            if (!block.getComponent("dungeons:custom_leaves")) return;
            if (block.below().isAir) {
                const xOffset = Math.random() - 0.5
                const zOffset = Math.random() - 0.5
                const origin = block.location
                dim.spawnParticle(block.typeId.replace("dungeons:","dungeons:falling_"), { x: origin.x + xOffset, y: origin.y - 0.1, z: origin.z + zOffset })
            }
            tryOpaque(block, dim)
        },
        onPlayerBreak(e) {
            if (borderGenerating(e.dimension.id)) return;
            const block = e.block;
            const dim = e.dimension;
            const checks = [
                block.above(),
                block.below(),
                block.east(),
                block.south(),
                block.west(),
                block.north()
            ]
            for (const target of checks) {
                if (!dim.isChunkLoaded(target.location)) return
                if (target.getComponent("dungeons")) tryOpaque(target, target.dimension)
            }
        },
        onPlace(e) {
            if (borderGenerating(e.dimension.id)) return;
            const block = e.block;
            const dim = e.dimension;
            if (!dim.isChunkLoaded(block.location)) return
            const checks = [
                block.above(),
                block.below(),
                block.east(),
                block.south(),
                block.west(),
                block.north()
            ]
            for (const target of checks) {
                if (!target || !dim.isChunkLoaded(target.location)) return
                if (target.getComponent("dungeons:custom_leaves")) tryOpaque(target, target.dimension)
            }
        }
    })
})


world.beforeEvents.playerBreakBlock.subscribe((e) => {
    const player = e.player;
    const block = e.block;
    if (block.hasTag("dungeons:ignore_silk_touch")) return;
    if (!block.hasTag("dungeons:drop_from_shears")) return;
    if (!player) return;
    if (player.getGameMode() == "Creative") return;
    const held = player.getComponent("minecraft:equippable").getEquipment("Mainhand")
    if (!held) return;
    if (held.typeId !== "minecraft:shears") return;
    const drop = block.getItemStack()
    e.cancel = true;
    system.run(() => {
        block.dimension.runCommand(`setblock ${block.location.x} ${block.location.y} ${block.location.z} air destroy`)
        const item = block.dimension.spawnItem(drop, block.center())
        item.applyImpulse({ x: (Math.random() - 0.5) / 10, y: 0.03, z: (Math.random() - 0.5) / 10 })
    })
})