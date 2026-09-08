import {
    world,
    system,
    EntityDamageCause,
    BlockVolume
} from "@minecraft/server";
import { getDirection, makeVector, isValidTarget } from "main.js"

const breakable = [
    "minecraft:oak_leaves",
    "minecraft:birch_leaves",
    "minecraft:spruce_leaves",
    "minecraft:jungle_leaves",
    "minecraft:acacia_leaves",
    "minecraft:dark_oak_leaves",
    "minecraft:mangrove_leaves",
    "minecraft:cherry_leaves",
    "minecraft:pale_oak_leaves",
    "minecraft:azalea_leaves",
    "minecraft:azalea_leaves_flowered",
    "minecraft:warped_wart_block",
    "minecraft:nether_wart_block",
    "minecraft:oak_log",
    "minecraft:birch_log",
    "minecraft:spruce_log",
    "minecraft:jungle_log",
    "minecraft:acacia_log",
    "minecraft:dark_oak_log",
    "minecraft:mangrove_log",
    "minecraft:cherry_log",
    "minecraft:pale_oak_log",
    "minecraft:warped_stem",
    "minecraft:crimson_stem",
    "minecraft:oak_wood",
    "minecraft:birch_wood",
    "minecraft:spruce_wood",
    "minecraft:jungle_wood",
    "minecraft:acacia_wood",
    "minecraft:dark_oak_wood",
    "minecraft:mangrove_wood",
    "minecraft:cherry_wood",
    "minecraft:pale_oak_wood",
    "minecraft:warped_hyphae",
    "minecraft:crimson_hyphae",
    "minecraft:stripped_oak_log",
    "minecraft:stripped_birch_log",
    "minecraft:stripped_spruce_log",
    "minecraft:stripped_jungle_log",
    "minecraft:stripped_acacia_log",
    "minecraft:stripped_dark_oak_log",
    "minecraft:stripped_mangrove_log",
    "minecraft:stripped_cherry_log",
    "minecraft:stripped_pale_oak_log",
    "minecraft:stripped_warped_stem",
    "minecraft:stripped_crimson_stem",
    "minecraft:stripped_oak_wood",
    "minecraft:stripped_birch_wood",
    "minecraft:stripped_spruce_wood",
    "minecraft:stripped_jungle_wood",
    "minecraft:stripped_acacia_wood",
    "minecraft:stripped_dark_oak_wood",
    "minecraft:stripped_mangrove_wood",
    "minecraft:stripped_cherry_wood",
    "minecraft:stripped_pale_oak_wood",
    "minecraft:stripped_warped_hyphae",
    "minecraft:stripped_crimson_hyphae",
    "minecraft:dirt",
    "minecraft:grass_block",
    "minecraft:podzol",
    "minecraft:mycelium",
    "minecraft:grass_path",
    "minecraft:ice",
    "minecraft:snow",
    "minecraft:snow_layer",
    "minecraft:packed_ice",
    "minecraft:blue_ice",
    "minecraft:stone",
    "minecraft:andesite",
    "minecraft:granite",
    "minecraft:diorite",
    "minecraft:cobblestone",
    "minecraft:coal_ore",
    "minecraft:copper_ore",
    "minecraft:gold_ore",
    "minecraft:iron_ore",
    "minecraft:diamond_ore",
    "minecraft:emerald_ore",
    "minecraft:redstone_ore",
    "minecraft:lapis_ore",
    "minecraft:quartz_ore",
    "minecraft:nether_gold_ore",
    "minecraft:netherrack",
    "minecraft:basalt",
    "minecraft:blackstone",
    "minecraft:dripstone_block",
    "minecraft:bamboo"
]

function forgeCoreExplosion(block) {
    if (!block.isValid) return false;
    const perm = block.permutation;
    const state = perm.getState("dungeons:core_state");
    if (state !== "active") return false;
    const dim = block.dimension;
    const loc = block.center()
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 7,
        excludeFamilies: ['ignore']
    });
    for (const target of damageRange) {
        if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
            var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 3
            if (target.matches({ families: ["weak_to_forge_cores"] })) {
                target.applyDamage(1.33 * (30 - distanceBetween), { cause: EntityDamageCause.magic });
            } else {
                target.applyDamage(30 - distanceBetween, { cause: EntityDamageCause.entityExplosion });
            }
            const dir = getDirection(loc, target.location);
            target.applyKnockback(makeVector(dir, 1.6), 0.5)
        }
    }
    if (world.gameRules.tntExplodes == true) {
        var corner1 = { x: loc.x - 2, y: loc.y + 2, z: loc.z - 2 }
        var corner2 = { x: loc.x + 2, y: loc.y - 0, z: loc.z + 2 }
        var volume = dim.getBlocks((new BlockVolume(corner1, corner2)), {})
        for (const blockLoc of volume.getBlockLocationIterator()) {
            let nblock = dim.getBlock(blockLoc)
            if (breakable.includes(nblock.typeId) || nblock.hasTag("dungeons:broken_by_forge_core")) {
                dim.runCommand(`setblock ${nblock.x} ${nblock.y} ${nblock.z} air destroy`)
            }
        }
    }
    dim.spawnParticle("dungeons:forge_core_explosion", loc)
    dim.spawnParticle("dungeons:forge_core_dust", loc)
    dim.spawnParticle("dungeons:redstone_eruption_3", loc)
    dim.playSound("random.explode", loc, { pitch: 0.7 })
}

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:redstone_core", {
        onRedstoneUpdate(e) {
            const block = e.block;
            const newPower = e.powerLevel;
            const dim = e.dimension;
            const loc = block.center()

            const perm = block.permutation
            const state = perm.getState("dungeons:core_state")
            const charge = perm.getState("dungeons:charge")
            if (newPower == 0) return;
            if (block.below().typeId == "minecraft:redstone_block") return;
            if (state !== "ready" || charge < 10) {
                dim.playSound("block.forge_core.out_of_power", loc)
                return;
            }
            const newPerm = perm.withState("dungeons:core_state", "active")
            block.setPermutation(newPerm)
            dim.playSound("block.forge_core.activate", loc)
            dim.spawnParticle("dungeons:forge_core_activate", loc)

        },
        beforeOnPlayerPlace(e) {
            e.permutationToPlace = e.permutationToPlace.withState('dungeons:charge', 10);
        },
        onPlayerInteract(e) {
            const block = e.block;
            if (!block.isValid) return;
            const perm = block.permutation;
            const state = perm.getState("dungeons:core_state");
            const charge = perm.getState("dungeons:charge");
            const dim = block.dimension;
            const loc = block.center()
            if (state !== "ready" || charge !== 10) {
                dim.playSound("block.forge_core.out_of_power", loc)
                return;
            }
            const newPerm = perm.withState("dungeons:core_state", "active")
            block.setPermutation(newPerm)
            dim.playSound("block.forge_core.activate", loc)
            dim.spawnParticle("dungeons:forge_core_activate", loc)
        },
        onTick(e) {
            const block = e.block;
            if (!block.isValid) return;
            const perm = block.permutation;
            const state = perm.getState("dungeons:core_state");
            const charge = perm.getState("dungeons:charge");
            var newPerm = perm
            const dim = block.dimension;
            const loc = block.center()
            if (state == "ready") {
                if (charge == 0) {
                    newPerm = perm.withState("dungeons:charge", 10)
                }
            }
            if (state == "off") {
                dim.spawnParticle("minecraft:basic_smoke_particle", block.above().bottomCenter())
                const newCharge = charge + 1
                if (newCharge == 10) {
                    newPerm = perm.withState("dungeons:core_state", "ready").withState("dungeons:charge", 10)
                    dim.playSound("block.forge_core.recharge", loc)
                } else {
                    newPerm = perm.withState("dungeons:charge", newCharge)
                }
            }
            if (state == "active") {
                const newCharge = charge - 1
                if (newCharge <= 0) {
                    newPerm = perm.withState("dungeons:core_state", "off").withState("dungeons:charge", 0)
                    forgeCoreExplosion(block)

                } else {
                    newPerm = perm.withState("dungeons:charge", newCharge)
                }
            }
            block.setPermutation(newPerm)
        }
    });
})

world.afterEvents.projectileHitBlock.subscribe(e => {
    if (!e.getBlockHit()) return;
    const block = e.getBlockHit().block;
    if (!block.dimension.isChunkLoaded(block.location)) return;
    if (block.typeId === 'dungeons:redstone_core_block') {
        if (e.projectile) {
            if (e.projectile.typeId == "dungeons:redstone_monstrosity_projectile") {
                return;
            }
        }
        const perm = block.permutation
        const dim = block.dimension;
        const loc = block.center();

        const state = perm.getState("dungeons:core_state");
        const charge = perm.getState("dungeons:charge");
        if (state !== "ready" || charge !== 10) {
            dim.playSound("block.forge_core.out_of_power", loc)
            return;
        }
        const newPerm = perm.withState("dungeons:core_state", "active")
        block.setPermutation(newPerm)
        if (dim.isChunkLoaded(loc) == false) return;
        dim.playSound("block.forge_core.activate", loc)
        dim.spawnParticle("dungeons:forge_core_activate", loc)
    }
});