import {
    system,
    world
} from "@minecraft/server";

import { getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:scythe', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!attacker.isValid || !hit.isValid) return;



            const dir = getDirection(attacker.location, hit.location);
            hit.applyKnockback(makeVector(dir, 0.1), 0.1)
            const dim = hit.dimension;
            const targetLoc = hit.location;
            if (e.itemStack.typeId == "dungeons:skull_scythe") {
                dim.playSound("weapon.soul_scythe.hit.spooky", targetLoc, { volume: 1, pitch: 1 })
            } else {
                dim.playSound("weapon.soul_scythe.hit", targetLoc, { volume: 1, pitch: 1 })
            }
        },
        onMineBlock(e) {
            const block = e.block;
            const broken = e.minedBlockPermutation;
            if(!block  && !broken) return;
            const below = block.below()
            if(!below) return;
            const player = e.source;
            if(!crops.includes(broken.type.id) || below.typeId !== "minecraft:farmland") return;
            const growth = broken.getState("growth")
            if(growth < 7) return;
            const grid = [
                block.east(),
                block.west(),
                block.north(),
                block.south(),
                block.south().east(),
                block.north().east(),
                block.north().west(),
                block.south().west()
            ]
            var worked = false
            for(const check of grid) {
                var goBlock = undefined
                if(!goBlock) {
                    if(check && check.below().typeId == below.typeId && check.typeId == broken.type.id && check.permutation.getState("growth") == growth) goBlock = check
                }
                if(!goBlock) {
                    if(check.above() && check.typeId == below.typeId && check.above().typeId == broken.type.id && check.above().permutation.getState("growth") == growth) goBlock = check.above()
                }
                if(!goBlock) {
                    if(check.below() && check.below(2).typeId == below.typeId && check.below().typeId == broken.type.id && check.below().permutation.getState("growth") == growth) goBlock = check.below()
                }
                if(goBlock) {
                    worked = true
                    block.dimension.runCommand(`setblock ${goBlock.x} ${goBlock.y} ${goBlock.z} air destroy`)
                }
            }
            if(worked) {
                block.dimension.spawnParticle("dungeons:swirling", block.center())
            }
        }
    });
});


const crops = [
    "minecraft:carrots",
    "minecraft:potatoes",
    "minecraft:wheat",
    "minecraft:beetroot"
]