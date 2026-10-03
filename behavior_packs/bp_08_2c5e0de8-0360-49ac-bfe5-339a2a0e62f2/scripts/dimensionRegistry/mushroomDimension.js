import { world, system, EntityDamageCause } from "@minecraft/server";
import {hunts} from "./main.js"

//prevent mobSpawning

const cannotSpawn = [
    "creeper",
    "skeleton",
    "slime",
    "spider",
    "zombie",
    "enderman",
    "drowned",
    "witch",
    "zombie_villager",
    "zombie_villager_v2",
    "phantom",
    "dungeons:wraith",
    "dungeons:necromancer"
]

//cannot spawn regular mobs
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    const cause = e.cause;
    if (!entity.isValid) return;
    if (entity.dimension.id !== "dungeons:ancientdim_mushroom_dimension") return
    if (cause == "Spawned" && entity.matches({ families: ["monster"] })) {
        if (cannotSpawn.includes(entity.typeId.replace("minecraft:", ""))) {
            entity.remove()
        }
    }
    if (cause == "Event" && entity.matches({ families: ["monster"] })) {
        if (cannotSpawn.includes(entity.typeId.replace("dungeons:enchanted_", ""))) {
            entity.remove()
        }
    }
})

//generate terrain
system.runInterval(() => {
    if (!hunts) return;
    const dim = world.getDimension("dungeons:ancientdim_mushroom_dimension")
    for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (!player.isOnGround && !player.isJumping) continue
        for (let i = -30; i < 30; i++) {
            for (let j = -30; j < 30; j++) {
                const loc = {
                    x: player.location.x + i,
                    y: 59,
                    z: player.location.z + j
                }
                const block = dim.getBlock(loc)
                if (!block) continue;
                const above = dim.getBlock(loc).above()
                if (!above) continue;
                if (block.isAir || block.typeId == "dungeons:ancient_hunt_barrier" && (above.isAir || above.typeId == "dungeons:ancient_hunt_barrier")) {
                    block.setType("mycelium")
                    if (Math.random() > 0.95 && above.isAir) {
                        above.setType("red_mushroom")
                    } else if (Math.random() > 0.95 && above.isAir) {
                        above.setType("brown_mushroom")
                    } else if (Math.random() > 0.9 && above.isAir) {
                        above.setType("nether_sprouts")
                    }
                }
            }
        }
        attemptBarriers(player, dim)
    }

}, 10)

const canNeighbour = [
    "minecraft:dirt",
    "minecraft:mycelium"
]

const canBarrier = [
    "minecraft:air"
]

function attemptBarriers(entity, dim) {

    for (let i = -10; i < 10; i++) {
        for (let j = -10; j < 10; j++) {
            const loc = {
                x: entity.location.x + i,
                y: 60,
                z: entity.location.z + j
            }
            const block = dim.getBlock(loc)
            if (!block) continue;
            if (canNeighbour.includes(block.typeId)) continue;
            const neighbours = [
                block.east(),
                block.west(),
                block.north(),
                block.south()
            ]
            var makePillar = false
            for (const temp of neighbours) if (temp && canNeighbour.includes(temp.typeId)) makePillar = true
            if (makePillar) {
                for (let k = 60; k < 80; k++) {
                    const newLoc = {
                        x: loc.x,
                        y: k,
                        z: loc.z
                    }
                    const nBlock = dim.getBlock(newLoc)
                    if (nBlock && canBarrier.includes(nBlock.typeId)) nBlock.setType("dungeons:ancient_hunt_barrier")
                }

            }
        }
    }
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    const cause = e.cause;
    if (!entity.isValid) return;
    if (entity.dimension.id !== "dungeons:ancientdim_mushroom_dimension") return
    if (entity.typeId.includes("dungeons:") && cause == "Spawned") {
        attemptBarriers(entity, entity.dimension)
    }
})

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (e.damageSource.cause !== EntityDamageCause.suffocation) return;
    if (hurt.matches({ families: ["monster"] })) {
        const dim = hurt.dimension;
        const loc = hurt.location
        const nearestFriend = dim.getEntities({ maxDistance: 32, location: loc, minDistance: 2, type: "dungeons:ancient_hunt_mooshroom" })
        if (nearestFriend.length == 0) {
            hurt.remove()
        } else {
            var tpLoc = undefined
            for (const friend of nearestFriend) if (friend.location.y > hurt.location.y) tpLoc = friend.location
            if (tpLoc == undefined) return hurt.remove()
            hurt.teleport(tpLoc)
        }
    }
})