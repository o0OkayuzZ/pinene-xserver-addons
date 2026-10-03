

import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

const canReplace = [
    "minecraft:end_stone"
]


system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:end_moss", {})
})

world.beforeEvents.playerInteractWithBlock.subscribe((e) => {
    const player = e.player;
    const item = e.itemStack;
    if (!item) return;
    if (item.typeId !== "minecraft:bone_meal") return;
    const block = e.block;
    if (!block) return;
    if (block.above().isAir == false) {
        return;
    }
    const dim = block.dimension
    if (block.getComponent("dungeons:end_moss")) {
        if (player.getDynamicProperty("dungeons:moss_interact_cooldown") > 0) return
        player.setDynamicProperty("dungeons:moss_interact_cooldown", 4)
        system.run(() => {
            var blocksPlaced = 0
            const maxX = 2 + Math.round(Math.random())
            const maxZ = 3 + Math.round(Math.random())
            for (let i = 0 - maxX; i <= maxX; i++) {
                for (let j = 0 - maxZ; j <= maxZ; j++) {
                    var chance = 1
                    var edgeX = false
                    var edgeZ = false
                    if (i == maxX || i == 0 - maxX) edgeX = true
                    if (j == maxZ || j == 0 - maxZ) edgeZ = true
                    if ((edgeX && !edgeZ) || (!edgeX && edgeZ)) chance = 0.75
                    if (edgeX && edgeZ) chance = 0

                    if (Math.random() < chance) {
                        const setLoc = {
                            x: block.x + i,
                            y: block.y + 1,
                            z: block.z + j
                        }
                        var countDown = 4
                        var foundBlock = undefined
                        var vegetationBlock = undefined
                        if (dim.getBlock(setLoc).isAir) countDown = 6
                        for (let k = 0; k < countDown && foundBlock == undefined; k++) {
                            const testblock = dim.getBlock({
                                x: setLoc.x,
                                y: setLoc.y - k,
                                z: setLoc.z
                            })
                            if (testblock.above().isAir && canReplace.includes(testblock.typeId)) {
                                foundBlock = testblock
                            }
                        }
                        if (foundBlock) {
                            blocksPlaced += 1
                            foundBlock.setType(block.typeId)
                        }
                        for (let k = 0; k < countDown && vegetationBlock == undefined; k++) {
                            const testblock = dim.getBlock({
                                x: setLoc.x,
                                y: setLoc.y - k,
                                z: setLoc.z
                            })
                            if (testblock.above().isAir && testblock.typeId == block.typeId) {
                                vegetationBlock = testblock.above()
                            }
                        }
                        if (vegetationBlock && Math.random() > 0.6) {
                            blocksPlaced += 1
                                var type = undefined
                                if(Math.random() > 0.6) {
                                    type = "air"
                                } else {
                                    type = block.typeId.replace("mossy_end_stone","ender_grass")
                                }
                                vegetationBlock.setType(type)
                            
                        }
                    }
                }
            }
            if (blocksPlaced > 0) {
                dim.playSound("item.bone_meal.use", player.location)
                dim.spawnParticle("minecraft:crop_growth_area_emitter", block.above().center())
                //reduce bonemeal
                if (player.getGameMode() !== "Creative") {
                    const equipment = player.getComponent("minecraft:equippable")
                    if (item.amount - 1 > 0) {
                        item.amount -= 1;
                        equipment.setEquipment("Mainhand", item)
                    } else {
                        equipment.setEquipment("Mainhand", undefined)
                    }
                }
            }
        })
    }

})

system.runInterval(() => {
    for(const player of world.getAllPlayers()) {
        const cd = player.getDynamicProperty("dungeons:moss_interact_cooldown")
        if(!cd) continue
        if(cd <= 0) {
            player.setDynamicProperty("dungeons:moss_interact_cooldown", null)
        } else {
            player.setDynamicProperty("dungeons:moss_interact_cooldown", cd-1)
        }
    }
})