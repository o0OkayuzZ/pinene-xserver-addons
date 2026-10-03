import { world, system } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_corrupted_jungle"


//cannot spawn mobs above barrier height
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    const cause = e.cause;
    if (!entity.isValid) return;
    if (entity.dimension.id !== DIM_ID) return
    if (cause == "Spawned" && entity.matches({ families: ["monster"] }) || entity.matches({ families: ["mob"] })) {
        if (entity.location.y >= 72) entity.remove()
    } else if (cause == "Event" && entity.matches({ families: ["monster"] }) || entity.matches({ families: ["mob"] })) {
        if (entity.location.y >= 72) entity.remove()
    }
})

//generate barrier
system.runInterval(() => {
    if (!hunts) return;
    const dim = world.getDimension(DIM_ID)
    for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (!player.isOnGround && !player.isJumping) continue
          if(player.hasTag("dungeons:portal_proof")) continue;
        attemptBarriers(player, dim)
    }

}, 10)

const canBarrier = [
    "minecraft:air",
    "dungeons:ancient_hunt_barrier"
]

function attemptBarriers(entity, dim) {

    for (let i = -10; i < 10; i++) {
        for (let j = -10; j < 10; j++) {
            const loc = {
                x: entity.location.x + i,
                y: 62,
                z: entity.location.z + j
            }
            const block = dim.getBlock(loc)
            if (!block) continue;
            if (block.isAir == false) continue;
            if (dim.getTopmostBlock({ x: block.x, z: block.z }, block.y + 7) !== undefined) continue;
            var makePillar = true
            if (makePillar) {
                for (let k = 60; k < 74; k++) {
                    const newLoc = {
                        x: loc.x,
                        y: k,
                        z: loc.z
                    }
                    const nBlock = dim.getBlock(newLoc)
                    var type = "granite"
                    if (Math.random() > 0.5) type = "hardened_clay"
                    if (k >= 70 && Math.random() > 0.5) type = "dirt"
                    if (k >= 71 && Math.random() > 0.1) type = "dirt"
                    if (k >= 72) type = "dirt"
                    if (k == 73) type = "grass"
                    if (nBlock && canBarrier.includes(nBlock.typeId)) nBlock.setType(type)
                    if (k == 73) {
                        const above = nBlock.above()
                        if (above) {
                            if (Math.random() > 0.7) {
                                above.setType("minecraft:short_grass")
                            }
                        }
                    }
                }
            }
        }
    }
}


system.runInterval(() => {
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) player.spawnParticle("dungeons:corrupted_jungle_clouds", {
            x: player.location.x,
            y: 75,
            z: player.location.z
        })
    }
}, 10)