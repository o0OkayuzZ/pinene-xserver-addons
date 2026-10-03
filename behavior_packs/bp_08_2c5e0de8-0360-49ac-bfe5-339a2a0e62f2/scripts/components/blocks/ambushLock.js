
import {
    system,
    world,
    BlockVolume,
    MolangVariableMap
} from "@minecraft/server";


const canBeReplaced = [
    "minecraft:polished_blackstone_bricks",
    "minecraft:cracked_polished_blackstone_bricks",
    "minecraft:gilded_blackstone",
    "minecraft:blackstone"
]

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:trial_totem_lock", {
        onPlayerInteract(e, { params }) {
            const { block, dimension, player } = e;
            if (!block || !player) return;
            if (dimension.isChunkLoaded(block.location) == false) return;
            var open = false
            const volume = new BlockVolume({ x: block.x - 12, y: block.y + 6, z: block.z - 12 }, { x: block.x + 12, y: block.y - 6, z: block.z + 12 })
            const trialTotems = []
            const lockedTotems = []
            for (const blockLoc of volume.getBlockLocationIterator()) {
                if (!dimension.isChunkLoaded(blockLoc)) continue;
                if (blockLoc.y < dimension.heightRange.min) continue;
                if (blockLoc.y > dimension.heightRange.max) continue;
                const getBlock = dimension.getBlock(blockLoc)
                if (getBlock.getComponent("dungeons:trial_totem")) trialTotems.push(getBlock)
            }
            for (const totem of trialTotems) {
                const perm = totem.below().permutation;
                if (perm.getState("trial_spawner_state") !== 5 && perm.getState("trial_spawner_state") !== 4 && world.getDifficulty() !== "Peaceful" && world.gameRules.doMobSpawning) lockedTotems.push(totem)
            }
            if (lockedTotems.length == 0) open = true
            if (!open) {
                dimension.playSound("block.key_lock.rejected", block.location, { pitch: 0.6 })
                for (const totem of lockedTotems) {
                    for (let i = 0; i < 35; i++) {
                        system.runTimeout(() => {
                            particle(block, totem)
                        }, i / 2)
                    }
                }
            }
            if (open) {
                for (const totem of trialTotems) {
                    dimension.runCommand(`setblock ${totem.x} ${totem.y} ${totem.z} air destroy`)
                    dimension.runCommand(`setblock ${totem.x} ${totem.y - 1} ${totem.z} air destroy`)
                }
                var verticalCol = [block]
                for (let i = 0; i < 2; i++) {
                    if (canBeReplaced.includes(block.above(i + 1).typeId)) {
                        verticalCol.push(block.above(i + 1))
                    } else break;
                }
                for (let i = 0; i < 2; i++) {
                    if (canBeReplaced.includes(block.below(i + 1).typeId)) {
                        verticalCol.push(block.below(i + 1))
                    } else break;
                }
                dimension.playSound("block.key_lock.opened", block.center(), { pitch: 1 })
                breakBlock(block, true)
                for (const check of verticalCol) {
                    breakBlock(check, false)
                    hozCol(check)
                }
            }
        }
    });
})

function hozCol(block) {
    const horizontalCol = []
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.west(i + 1).typeId)) {
            horizontalCol.push(block.west(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.east(i + 1).typeId)) {
            horizontalCol.push(block.east(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.north(i + 1).typeId)) {
            horizontalCol.push(block.north(i + 1))
        } else break;
    }
    for (let i = 0; i < 5; i++) {
        if (canBeReplaced.includes(block.south(i + 1).typeId)) {
            horizontalCol.push(block.south(i + 1))
        } else break;
    }
    for (let i = 0; i < horizontalCol.length; i++) {
        system.runTimeout(() => {
            const check2 = horizontalCol[i]
            breakBlock(check2, false)
            breakBlock(check2.east(), false)
            breakBlock(check2.north(), false)
            breakBlock(check2.west(), false)
            breakBlock(check2.south(), false)
        })
    }
}

function breakBlock(block, bypass) {
    if (canBeReplaced.includes(block.typeId) || bypass) {
        block.setType("air")
        block.dimension.spawnParticle("dungeons:instant_teleport", block.center())
        system.runTimeout(() => {
            block.dimension.playSound("break.heavy_core", block.location, { volume: 1, pitch: Math.random() / 2 + 0.7 })
        }, Math.floor(Math.random() * 5))
    }
}

const particleSpeed = 12

function particle(block, totem) {
    const dim = block.dimension
    var eLoc = block.center();
    eLoc = { x: eLoc.x, y: eLoc.y, z: eLoc.z }
    var tLoc = totem.center();
    tLoc = { x: tLoc.x, y: tLoc.y, z: tLoc.z }
    var dx = tLoc.x - eLoc.x
    var dy = tLoc.y - eLoc.y
    var dz = tLoc.z - eLoc.z
    const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

    dx = dx / length
    dy = dy / length
    dz = dz / length

    const lifetime = length / particleSpeed

    var map = new MolangVariableMap()
    map.setColorRGB("variable.color", { red: 1, green: 1 - Math.random() / 2, blue: 0 })
    map.setFloat("variable.particle_initial_speed", particleSpeed)
    map.setFloat("variable.max_lifetime", lifetime)
    try {
        map.setVector3("variable.direction", { x: dx, y: dy, z: dz })
    } catch {
        return;
    }

    var xOffset = Math.random() * 0.2 - 0.1
    var yOffset = Math.random() * 0.2 - 0.1
    var zOffset = Math.random() * 0.2 - 0.1
    if (dim.isChunkLoaded(eLoc)) dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
}