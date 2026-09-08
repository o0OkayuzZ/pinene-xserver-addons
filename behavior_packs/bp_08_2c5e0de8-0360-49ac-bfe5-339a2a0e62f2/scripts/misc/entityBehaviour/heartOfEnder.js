import {
    world,
    system,
    EntityDamageCause,
    DimensionTypes,
    MolangVariableMap,
    BlockVolume
} from "@minecraft/server";

import { isValidTarget, makeVector, getDirection } from "main.js"

const unbreakableBlocks = [

]

//origin
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (entity.typeId !== "dungeons:heart_of_ender") return;
    const loc = entity.location
    entity.setDynamicProperty("dungeons:center", { x: loc.x, y: loc.y, z: loc.z });
    entity.addEffect("slowness", 999999, { amplifier: 255, showParticles: false })
})

//move code
function faceNearestPlayer(entity) {
    const players = entity.dimension.getPlayers({ maxDistance: 63, location: entity.location, excludeGameModes: ["Spectator"] })
    if (players.length) entity.lookAt(players[0].location)
}

function moveToLoc(entity, targetLoc, count) {
    if (entity.getProperty("dungeons:moving")) return;
    if (entity.getProperty("dungeons:spinning_lasers")) return;
    entity.setProperty("dungeons:moving", true)
    const loc = entity.location;
    var fail = false
    for (let i = 0; i < 200 && fail == false; i++) {
        system.runTimeout(() => {
            if (fail == true) return;
            if (entity.dimension.getEntitiesAtBlockLocation(targetLoc).includes(entity)) {
                fail = true
                return finishWalking(entity)
            } else if (i > 90) {
                fail = true
                return failedWalking(entity)
            }
            entity.lookAt(targetLoc)
            const v = entity.getViewDirection()
            const relLoc = entity.location
            const tp = entity.tryTeleport({ x: relLoc.x + v.x / (count * 0.2), y: relLoc.y, z: relLoc.z + v.z / (count * 0.2) }, { checkForBlocks: true })
            if (!tp) {
                fail = true
                return failedWalking(entity)
            } else {
                if (i % 4 == 0) {
                    createVoidPath(entity.dimension, entity.location)
                }
            }
        }, i)
    }
}
function failedWalking(entity, loc) {
    if (!loc) loc = entity.getDynamicProperty("dungeons:center")
    entity.playAnimation("animation.heart_of_ender.sink")
    entity.setProperty("dungeons:moving", false)
    system.runTimeout(() => {
        entity.addEffect("invisibility", 6, { showParticles: false })
        system.runTimeout(() => {
            entity.tryTeleport(loc)
        }, 1)
        system.runTimeout(() => {

            entity.playAnimation("animation.heart_of_ender.rise")
            entity.dimension.spawnParticle("dungeons:heart_of_ender_burst", entity.location)
            faceNearestPlayer(entity)
        }, 6)
    }, 10)
}
function finishWalking(entity) {
    if (Math.random() > 0.8) {
        entity.setProperty("dungeons:moving", false)
        system.runTimeout(() => {

            entity.triggerEvent("dungeons:erratic_movement")
        }, 1)
    } else {
        entity.setProperty("dungeons:moving", false)
        faceNearestPlayer(entity)
    }
}

function createVoidPath(dim, loc) {
    dim.spawnParticle("dungeons:heart_of_ender_dangerous_area1", { x: loc.x, y: loc.y + 0.3, z: loc.z })
    dim.spawnParticle("dungeons:heart_of_ender_dangerous_area2", { x: loc.x, y: loc.y + -0.1, z: loc.z })
    for (let i = 10; i < 120; i += 10) {
        system.runTimeout(() => {
            const players = dim.getPlayers({ location: loc, maxDistance: 2 })
            for (const player of players) {
                const dmg = player.applyDamage(0.1)
                if (dmg) {
                    const hp = player.getComponent("health")
                    const current = hp.currentValue
                    var setTo = current - (hp.defaultValue / 50)
                    if (setTo <= 0.5) setTo = 0.5
                    hp.setCurrentValue(setTo)
                    player.runCommand("camerashake add @s 0.15 0.5 rotational")
                }
            }
        }, i)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:erratic_movement' && entity.typeId == "dungeons:heart_of_ender") {
        if (Math.random() > 0.5) return;
        const loc = entity.location
        const dir = Math.random()
        var dist = 10
        if (Math.random() > 0.5) dist = dist * -1
        if (dir < 0.5) {
            moveToLoc(entity, { x: loc.x - dist, y: loc.y, z: loc.z }, 8)
        } else {
            moveToLoc(entity, { x: loc.x, y: loc.y, z: loc.z - dist }, 8)

        }
    }
})



//bombs
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId !== "dungeons:heart_of_ender_scatter_mine") return;
    if (id == "dungeons:scatter_mine") {
        var loc = entity.location;
        const dim = entity.dimension;
        const xOffset = Math.random() * 4 - 2
        const zOffset = Math.random() * 4 - 2
        const newLoc = { x: loc.x + xOffset, y: loc.y, z: loc.z + zOffset }
        var tp = entity.tryTeleport(newLoc)
        if (tp) loc = newLoc
        system.runTimeout(() => {

            dim.playSound("weapon.enchant.exploding", loc, { volume: 2, pitch: 2 + Math.random() * 0.4 })
            dim.spawnParticle("dungeons:obsidian_lightning_strike", loc)
        }, 20)
    }
    if (id === 'dungeons:obsidian_scatter_mine_explode') {
        if (!entity.isValid) return;
        var loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:endersent_teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
        dim.spawnParticle("dungeons:endersent_teleport_boom_dust", loc)
        dim.playSound("random.explode", loc, { pitch: 0.5 })
        dim.playSound("armour.teleport.explode", loc)
        const fire = dim.spawnEntity("dungeons:enchanted_fire", loc)
        system.runTimeout(() => {
            if (fire.isValid) fire.remove()
        }, Math.floor(Math.random() * 60) + 50)
        if (entity.isValid) entity.remove()

        const targets = dim.getEntities({ location: loc, maxDistance: 6 })
        for (const target of targets) {
            if (target.typeId == "minecraft:vindicator") continue;
            if ((isValidTarget(target) || target.matches({ families: ["player"] }))) {
                const damage = target.applyDamage(20, { cause: EntityDamageCause.entityExplosion })
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.1 1.5")
                        target.runCommand("camerashake add @s 0.1 1")
                        target.runCommand("camerashake add @s 0.1 0.5")
                    }
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 0.6), 0.4)
                }
            }
        }

        for (const mine of dim.getEntities({ type: entity.typeId, maxDistance: 5, minDistance: 0.5, location: loc })) {
            system.runTimeout(() => {
                if (mine.isValid) mine.triggerEvent("dungeons:obsidian_scatter_mine_explode")
            }, 3)
        }
    }
});


//lasers to center
function spawnHead(center, dim, ticks) {
    var validLoc = false
    var spawnLoc = undefined
    var rotation = 0
    var locOps = [
        { x: 6, z: 0 },
        { x: -6, z: 0 },
        { x: 0, z: 6 },
        { x: 0, z: -6 }
    ]

    var player = dim.getEntities({
        location: center,
        maxDistance: 43,
        families: ["player"],
        excludeGameModes: ["Spectator"]
    })
    if (player.length > 0) {
        player = player[0]
        const playerLoc = player.location
        for (let i = 0; i < 4; i++) {
            if (!validLoc && locOps.length > 0) {
                const locOpp = locOps[Math.floor(Math.random() * locOps.length)]
                spawnLoc = {
                    x: playerLoc.x + locOpp.x,
                    y: center.y,
                    z: playerLoc.z + locOpp.z
                }
                const heads = dim.getEntities({
                    location: spawnLoc,
                    maxDistance: 7,
                    type: "dungeons:heart_of_ender_head"
                })
                if (heads.length == 0 && dim.getBlock(spawnLoc).isAir) {
                    validLoc = true
                    if (locOpp.z == 6) rotation = 180
                    if (locOpp.x == 6) rotation = 90
                    if (locOpp.x == -6) rotation = -90
                } else {
                    const newArray = []
                    for (const loc of locOps) if (loc !== locOpp) newArray.push(loc)
                    locOps = newArray
                }
            }
        }
    }

    for (let i = 0; i < 20; i++) {
        if (!validLoc) {
            var xRand = Math.random() * 4 - 2
            var zRand = Math.random() * 4 - 2
            spawnLoc = {
                x: center.x + xRand,
                y: center.y,
                z: center.z + zRand
            }
            const heads = dim.getEntities({
                location: spawnLoc,
                maxDistance: 4,
                type: "dungeons:heart_of_ender_head"
            })
            if (heads.length == 0 && dim.getBlock(spawnLoc).isAir) {
                validLoc = true
                rotation = (Math.floor(Math.random() * 4) - 0) * 90
            }
        }
    }
    if (!validLoc) return;
    const head = dim.spawnEntity("dungeons:heart_of_ender_head", dim.getBlock(spawnLoc).bottomCenter(), { initialRotation: rotation })

    head.dimension.spawnParticle("dungeons:heart_of_ender_burst", head.location)
    system.runTimeout(() => {
        head.addTag("dungeons:laser_on")
    }, 12)
    system.runTimeout(() => {
        head.triggerEvent("dungeons:sink_laser_head")
        head.removeTag("dungeons:laser_on")
    }, ticks)
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:return_from_laser_heads_failure' && entity.typeId == "dungeons:heart_of_ender") {
        if (!entity.hasTag("dungeons:laser_heads")) return;
        entity.removeTag("dungeons:laser_heads")
        entity.addEffect("invisibility", 1, { showParticles: false })
        entity.triggerEvent("dungeons:remove_immune")
        entity.setProperty("dungeons:hidden", false)

        entity.playAnimation("animation.heart_of_ender.rise")
        entity.dimension.spawnParticle("dungeons:heart_of_ender_burst", entity.location)
        faceNearestPlayer(entity)
    }
})
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:scatter_lasers' && entity.typeId == "dungeons:heart_of_ender") {
        const rand = Math.random()
        if (rand < 0.5) {
            entity.triggerEvent("dungeons:start_spinning_lasers")
        } else {
            entity.triggerEvent("dungeons:become_immune")
            const loc = entity.getDynamicProperty("dungeons:center")
            entity.playAnimation("animation.heart_of_ender.sink")
            entity.setProperty("dungeons:moving", false)
            system.runTimeout(() => {
                entity.setProperty("dungeons:hidden", true)
                entity.addEffect("invisibility", 40, { showParticles: false })
                system.runTimeout(() => {
                    entity.tryTeleport(loc)
                    const dim = entity.dimension
                    system.runTimeout(() => {
                        entity.addTag("dungeons:laser_heads")
                        spawnHead({ x: loc.x + 12, y: loc.y, z: loc.z + 6 }, dim, 160)
                    }, 20)
                    system.runTimeout(() => {
                        spawnHead({ x: loc.x - 12, y: loc.y, z: loc.z + 6 }, dim, 140)
                    }, 50)
                    system.runTimeout(() => {
                        spawnHead({ x: loc.x, y: loc.y, z: loc.z - 12 }, dim, 120)
                    }, 80)
                    system.runTimeout(() => {
                        spawnHead({ x: loc.x, y: loc.y, z: loc.z - 12 }, dim, 100)
                    }, 110)
                    system.runTimeout(() => {
                        entity.removeTag("dungeons:laser_heads")
                        entity.addEffect("invisibility", 1, { showParticles: false })
                        entity.triggerEvent("dungeons:remove_immune")
                        entity.setProperty("dungeons:hidden", false)

                        entity.playAnimation("animation.heart_of_ender.rise")
                        entity.dimension.spawnParticle("dungeons:heart_of_ender_burst", entity.location)
                        faceNearestPlayer(entity)
                    }, 140)
                }, 1)
            }, 10)
        }
    }
})

system.runInterval(() => {
    for (const dimId of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimId.typeId)
        for (const entity of dim.getEntities({ type: "dungeons:heart_of_ender_head", tags: ["dungeons:laser_on"] })) {
            const rayCast = []
            const rot = entity.getRotation()
            var x = 0
            var z = 0
            if (rot.y == -180) z = -1
            if (rot.y == 0) z = 1
            if (rot.y == 90) x = -1
            if (rot.y == -90) x = 1
            for (let i = 0; i < 49; i++) {
                var tempLoc = {
                    x: entity.location.x + i * x,
                    y: entity.location.y + 1,
                    z: entity.location.z + i * z
                }
                const entities = dim.getEntities({ location: tempLoc, maxDistance: 1.5 })
                for (const temp of entities) {
                    if (temp.typeId == entity.typeId) continue;
                    if (temp.matches({ families: ["monster"] })) continue;
                    if (!rayCast.includes(temp)) rayCast.push(temp)
                }

            }
            for (const target of rayCast) {
                const difficulty = world.getDifficulty()
                var dmg = 1
                var easyDmg = dmg / 2 + 1
                if (easyDmg > dmg) easyDmg = dmg / 2
                var hardDmg = dmg * 1.5
                if (difficulty == "Easy") dmg = easyDmg
                if (difficulty == "Hard") dmg = hardDmg
                var isShielded = false
                if (target.typeId == "minecraft:player" && target.isSneaking) {
                    const equippable = target.getComponent("equippable")
                    if (equippable.getEquipment("Mainhand") && equippable.getEquipment("Mainhand").typeId == "minecraft:shield") isShielded = true
                    if (equippable.getEquipment("Offhand") && equippable.getEquipment("Offhand").typeId == "minecraft:shield") isShielded = true
                }
                if (isShielded) {

                    const damage = target.applyDamage(dmg * 3, { cause: EntityDamageCause.entityAttack })
                } else {

                    const damage = target.applyDamage(dmg * 0.66, { cause: EntityDamageCause.override })
                }
            }
        }
    }
})


//spinning beam

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:start_spinning_lasers' && entity.typeId == "dungeons:heart_of_ender") {
        const loc = entity.getDynamicProperty("dungeons:center")
        entity.playAnimation("animation.heart_of_ender.sink")
        entity.setProperty("dungeons:moving", false)
        system.runTimeout(() => {
            entity.addEffect("invisibility", 6, { showParticles: false })
            system.runTimeout(() => {
                entity.tryTeleport(loc)
            }, 1)
            system.runTimeout(() => {

                entity.playAnimation("animation.heart_of_ender.rise")
                entity.dimension.spawnParticle("dungeons:heart_of_ender_burst", entity.location)
                faceNearestPlayer(entity)
                system.runTimeout(() => {
                    const spawnLoc = {
                        x: loc.x,
                        y: loc.y + 0.4,
                        z: loc.z
                    }
                    const dim = entity.dimension;
                    dim.playSound("mob.heart_of_ender.shoot_laser", spawnLoc)
                    const l1 = dim.spawnEntity("dungeons:heart_of_ender_laser", spawnLoc, { initialRotation: 0 })
                    const l2 = dim.spawnEntity("dungeons:heart_of_ender_laser", spawnLoc, { initialRotation: 90 })
                    const l3 = dim.spawnEntity("dungeons:heart_of_ender_laser", spawnLoc, { initialRotation: -90 })
                    const l4 = dim.spawnEntity("dungeons:heart_of_ender_laser", spawnLoc, { initialRotation: 180 })
                    system.runTimeout(() => {
                        entity.triggerEvent("dungeons:stop_spinning_lasers")
                        if (l1.isValid) l1.remove()
                        if (l2.isValid) l2.remove()
                        if (l3.isValid) l3.remove()
                        if (l4.isValid) l4.remove()
                    }, 105 + Math.floor(Math.random() * 80))
                }, 20)
            }, 6)
        }, 10)
    }
})


const beamSpeed = 2.246 * 1.25

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:spin_beam' && entity.typeId == "dungeons:heart_of_ender_laser") {
        if (!entity.isValid) return;
        entity.runCommand(`tp ~ ~ ~ ~-${beamSpeed} 0`)
    }
})

system.runInterval(() => {
    for (const dimId of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimId.typeId)
        for (const entity of dim.getEntities({ type: "dungeons:heart_of_ender_laser" })) {
            const rayCast = []
            const rot = entity.getViewDirection()
            var x = rot.x
            var z = rot.z
            for (let i = 0; i < 49; i++) {
                var tempLoc = {
                    x: entity.location.x + i * x,
                    y: entity.location.y + 1,
                    z: entity.location.z + i * z
                }
                if (dim.isChunkLoaded(tempLoc)) dim.spawnParticle("dungeons:heart_of_ender_beam_trail", tempLoc)
                const entities = dim.getEntities({ location: tempLoc, maxDistance: 2 })
                for (const temp of entities) {
                    if (temp.typeId == entity.typeId) continue;
                    if (temp.matches({ families: ["ignore"] })) continue;
                    if (temp.matches({ families: ["inanimate"] })) continue;
                    if (temp.matches({ families: ["heart_of_ender"] })) continue;
                    if (temp.typeId == "minecraft:item") continue;
                    if (!rayCast.includes(temp)) rayCast.push(temp)
                }

            }
            for (const target of rayCast) {
                const difficulty = world.getDifficulty()
                var dmg = 3.6
                if (difficulty == "Easy") dmg = 1
                if (difficulty == "Normal") dmg = 2.5
                var isShielded = false
                if (target.typeId == "minecraft:player" && target.isSneaking) {
                    const equippable = target.getComponent("equippable")
                    if (equippable.getEquipment("Mainhand") && equippable.getEquipment("Mainhand").typeId == "minecraft:shield") isShielded = true
                    if (equippable.getEquipment("Offhand") && equippable.getEquipment("Offhand").typeId == "minecraft:shield") isShielded = true
                }
                if (isShielded) {

                    const damage = target.applyDamage(dmg * 3, { cause: EntityDamageCause.entityAttack })
                } else {

                    const damage = target.applyDamage(dmg, { cause: EntityDamageCause.override })
                }
            }
        }
    }
}, 2)
