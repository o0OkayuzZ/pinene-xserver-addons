import { world, system } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_frosted_fjord"


//cannot spawn mobs above barrier height
world.afterEvents.entitySpawn.subscribe((e) => {
    if(!hunts) return;
    const entity = e.entity;
    const cause = e.cause;
    if (!entity.isValid) return;
    if (entity.dimension.id !== DIM_ID) return
    if (cause == "Spawned" && entity.matches({ families: ["monster"] }) || entity.matches({ families: ["mob"] })) {
        if (entity.location.y >= 70) entity.remove()
    } else if (cause == "Event" && entity.matches({ families: ["monster"] }) || entity.matches({ families: ["mob"] })) {
        if (entity.location.y >= 70) entity.remove()
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
                for (let k = 60; k < 73; k++) {
                    const newLoc = {
                        x: loc.x,
                        y: k,
                        z: loc.z
                    }
                    const nBlock = dim.getBlock(newLoc)
                    var type = "stone"
                    if(Math.random() > 0.67) type = "andesite"
                    if (k == 72) type = "snow"
                    if (nBlock && canBarrier.includes(nBlock.typeId)) nBlock.setType(type)
                    if (k == 72) {
                        const above = nBlock.above()
                        if (above) {
                            if (Math.random() > 0.7) {
                                above.setType("minecraft:snow_layer")
                            }
                        }
                    }
                }
            }
        }
    }
}


system.runInterval(() => {
    if(!hunts) return;
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) {
            player.spawnParticle("dungeons:frosted_fjord_clouds", {
                x: player.location.x,
                y: 75,
                z: player.location.z
            })
            const locs = [
                {x:player.location.x, y:67, z:player.location.z},
                {x:player.location.x, y:77, z:player.location.z},
                {x:player.location.x-15, y:67, z:player.location.z},
                {x:player.location.x+15, y:67, z:player.location.z},
                {x:player.location.x, y:67, z:player.location.z-15},
                {x:player.location.x, y:67, z:player.location.z+15}
            ]
            for(const loc of locs) {
                if (player.dimension.isChunkLoaded(loc)) {
                    player.spawnParticle("dungeons:frosted_fjord_snow", loc)
                }
            }
        }
    }
}, 10)