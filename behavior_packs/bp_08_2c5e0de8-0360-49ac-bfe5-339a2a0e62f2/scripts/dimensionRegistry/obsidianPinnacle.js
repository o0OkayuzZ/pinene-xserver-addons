import { world, system, EntityDamageCause } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_obsidian_fortress"


//generate barrier
system.runInterval(() => {
    if (!hunts) return;
    const dim = world.getDimension(DIM_ID)
    for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (!player.isOnGround && !player.isJumping) continue
        attemptBarriers(player, dim)
    }

}, 10)

const canBarrier = [
    "minecraft:air"
]

function attemptBarriers(entity, dim) {

    for (let i = -10; i < 10; i++) {
        for (let j = -10; j < 10; j++) {
            const loc = {
                x: entity.location.x + i,
                y: 75,
                z: entity.location.z + j
            }
            const block = dim.getBlock(loc)
            if (!block) continue;
            if (block.isAir == false) continue;
            if (dim.getTopmostBlock({ x: block.x, z: block.z }, block.y + 10) !== undefined) continue;
            var makePillar = true
            if (makePillar) {
                for (let k = 70; k < 90; k++) {
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
    if(!hunts) return;
    const entity = e.entity;
    const cause = e.cause;
    if (!entity.isValid) return;
    if (entity.dimension.id !== DIM_ID) return
    if (entity.typeId.includes("dungeons:") && cause == "Spawned") {
        attemptBarriers(entity, entity.dimension)
    }
})

system.runInterval(() => {
    if(!hunts) return;
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) player.spawnParticle("dungeons:obsidian_fortress_ambient", player.location)
    }
}, 2)
system.runInterval(() => {
    if(!hunts) return;
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) player.spawnParticle("dungeons:obsidian_fortress_clouds", {
            x: player.location.x,
            y: 67,
            z: player.location.z
        })
    }
}, 10)

const lowerStrike = [
    "minecraft:air",
    "dungeons:ancient_hunt_barrier"
]

system.runInterval(() => {
    if(!hunts) return;
    const dimension = world.getDimension(DIM_ID)
    if (Math.random() > 0.01) return;
    const players = dimension.getPlayers()
    if (players.length == 0) return;
    const target = players[Math.floor(Math.random() * players.length)]
    var x = Math.random() * 22 - Math.random() * 22
    var z = Math.random() * 22 - Math.random() * 22
    var loc = {
        x: target.location.x + x,
        y: target.location.y,
        z: target.location.z + z
    }
    if (!dimension.isChunkLoaded(loc)) return;
    const block = dimension.getBlock(loc).below()
    if (lowerStrike.includes(block.typeId)) {
        loc = {
            x: loc.x,
            y: 30,
            z: loc.z
        }
    }
    dimension.spawnEntity("lightning_bolt", loc)
}, 20)