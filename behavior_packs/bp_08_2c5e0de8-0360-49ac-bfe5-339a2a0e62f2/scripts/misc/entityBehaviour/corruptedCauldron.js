import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

//tick fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:wraith_fire_hit' && entity.typeId == "dungeons:corrupted_cauldron_fire") {
        if (!entity.isValid) return;
        const dim = entity.dimension;
        const loc = entity.location;
        if (Math.random() > 0.25) dim.spawnParticle("dungeons:wretched_wraith_fire_smoke", loc)
        const damageRange = dim.getEntitiesAtBlockLocation(loc)
        if (damageRange.length < 1) return;
        var targets = []

        var damage = 4
        if (world.getDifficulty() == "Hard") damage += 1
        if (world.getDifficulty() == "Easy") damage -= 1
        for (const damaged of damageRange) {
            if (targets.includes(damaged)) continue;
            if (damaged.matches({ families: ["undead"] })) continue;
            if (damaged.matches({ families: ["monster"] })) continue;
            if (damaged.typeId == "minecraft:player") {
                if (damaged.getGameMode() == "Creative") continue;
            }
            if (damaged.matches({ families: ["player"] }) || damaged.matches({ families: ["mob"] }) || damaged.matches({ families: ["animal"] })) targets.push(damaged)
        }
        if (targets.length < 1) return;
        for (const target of targets) {
            const didDamage = target.applyDamage(damage, { cause: EntityDamageCause.magic })
            if (didDamage && damage > 1) target.setOnFire(1)
        }
    }
})

//spawn fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:spawn_cauldron_fire' && entity.typeId == "dungeons:corrupted_cauldron_fire") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y + 4).above()
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: block.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 })
            if ((isFire.length >= 2 && isFire.includes(entity)) || (isFire.length >= 1 && !isFire.includes(entity))) {
                entity.remove()
            } else {
                entity.tryTeleport(block.bottomCenter())
            }
        }
        if (!entity.isValid) return;
        //dim.playSound("mob.wraith.fire", block.bottomCenter())
        const offsets = [
            { x: -3, z: -2 },
            { x: -3, z: -1 },
            { x: -3, z: 0 },
            { x: -3, z: 1 },
            { x: -3, z: 2 },
            { x: -2, z: -3 },
            { x: -2, z: -2 },
            { x: -2, z: -1 },
            { x: -2, z: 0 },
            { x: -2, z: 1 },
            { x: -2, z: 2 },
            { x: -2, z: 3 },
            { x: -1, z: -3 },
            { x: -1, z: -2 },
            { x: -1, z: -1 },
            { x: -1, z: 0 },
            { x: -1, z: 1 },
            { x: -1, z: 2 },
            { x: -1, z: 3 },
            { x: 0, z: -3 },
            { x: 0, z: -2 },
            { x: 0, z: -1 },
            { x: 0, z: 0 },
            { x: 0, z: 1 },
            { x: 0, z: 2 },
            { x: 0, z: 3 },
            { x: 1, z: -3 },
            { x: 1, z: -2 },
            { x: 1, z: -1 },
            { x: 1, z: 0 },
            { x: 1, z: 1 },
            { x: 1, z: 2 },
            { x: 1, z: 3 },
            { x: 2, z: -3 },
            { x: 2, z: -2 },
            { x: 2, z: -1 },
            { x: 2, z: 0 },
            { x: 2, z: 1 },
            { x: 2, z: 2 },
            { x: 2, z: 3 },
            { x: 3, z: -2 },
            { x: 3, z: -1 },
            { x: 3, z: 0 },
            { x: 3, z: 1 },
            { x: 3, z: 2 }
        ]
        system.runTimeout(() => {
            for (const offset of offsets) {
                const newSpawnLoc = { x: block.x + offset.x, y: block.y + 4, z: block.z + offset.z }
                const newblock = dim.getTopmostBlock({ x: newSpawnLoc.x, z: newSpawnLoc.z }, newSpawnLoc.y).above()
                if (newblock.below().isAir == false) {
                    const isFire = dim.getEntities({ location: newblock.bottomCenter(), families: ["dungeons_fire"], maxDistance: 0.1 })
                    if (isFire.length >= 1) continue;
                    const newFire = dim.spawnEntity(entity.typeId, newblock.bottomCenter())
                    newFire.addEffect("invisibility", 3, { showParticles: false })
                }
            }
        }, 3)
    }
})

//fire attack
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:corrupted_cauldron_fire_attack' && entity.typeId == "dungeons:corrupted_cauldron") {
        entity.playAnimation("animation.corrupted_cauldron.fire_attack")
        const loc = entity.location
        const dim = entity.dimension
        system.runTimeout(() => {
            dim.spawnEntity("dungeons:corrupted_cauldron_fire", loc, { spawnEvent: "dungeons:spawn_cauldron_fire" })
        }, 7)
    }
})

//healing

const ticksToHeal = 50
const percentageHealed = 0.2

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId !== "dungeons:corrupted_cauldron") return;
    if (id === 'dungeons:healing_failed') {
        const loc = entity.location
        const dim = entity.dimension
        dim.playSound("artefact.shadow_break", loc, { pitch: 0.5 })
        entity.playAnimation("animation.corrupted_cauldron.botch")
        entity.runCommand("stopsound @a[r=32] mob.corrupted_cauldron.charge")
        return;
    }
    if (id === 'dungeons:healing_success') {
        entity.playAnimation("animation.corrupted_cauldron.heal")
        entity.runCommand("stopsound @a[r=32] mob.corrupted_cauldron.charge")
        for (let i = 0; i < ticksToHeal; i++) {
            system.runTimeout(() => {
                if (entity.isValid == false) return;
                let hp = entity.getComponent('minecraft:health');
                const healAmt = hp.defaultValue * percentageHealed
                if (hp.currentValue == hp.defaultValue) return;
                if (hp.currentValue > hp.defaultValue - (healAmt / ticksToHeal)) {
                    hp.setCurrentValue(hp.defaultValue)
                } else {
                    hp.setCurrentValue(hp.currentValue + (healAmt / ticksToHeal))
                }
            }, i)
        }
    }
})


//Absorb dead mobs
import { makeVector, getDirection } from "main.js"

function pull(pulled, entity) {
    var mult = 8;
    if (pulled.typeId === 'minecraft:player' && pulled.isFlying) return;
    if (pulled.isSprinting) {
        mult = mult * 0.33;
    }
    if (!pulled.isOnGround) {
        mult = mult * 0.5;
    }
    if (pulled.isOnGround && pulled.isSneaking) {
        mult = mult * 0.4
    }
    const dir = getDirection(pulled.location, entity.location)
    var y = -0.01
    if (pulled.location.y + 0.5 <= entity.location.y) y = 0.2
    pulled.applyImpulse({ x: makeVector(dir, 0.04 * mult).x, y: y, z: makeVector(dir, 0.04 * mult).z })
}

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (!deadEntity) return;
    if (!deadEntity.isValid) return;
    if (deadEntity.matches({
        excludeFamilies: ["ignore", "gravity_immune"],
        families: ['undead']
    })) {
        for (let i = 0; i < 20; i++) {
            system.runTimeout(() => {
                if (deadEntity.isValid == false) return;
                const dim = deadEntity.dimension;
                const loc = deadEntity.location
                const nearestCauldron = dim.getEntities({
                    type: "dungeons:corrupted_cauldron",
                    location: loc,
                    maxDistance: 16,
                    closest: 1
                })
                if (nearestCauldron.length == 1) {
                    var cauldron = nearestCauldron[0]
                    pull(deadEntity, cauldron)
                    const cauldronloc = cauldron.location
                    const baseDist = Math.hypot(cauldronloc.x - loc.x, cauldronloc.y - loc.y, cauldronloc.z - loc.z)
                    if (baseDist < 1.5) {
                        cauldron.playAnimation("animation.corrupted_cauldron.fire_attack")
                        deadEntity.remove()
                        for (let j = 0; j < 20; j++) {
                            system.runTimeout(() => {
                                if (cauldron.isValid == false) return;
                                let hp = cauldron.getComponent('minecraft:health');
                                const healAmt = hp.defaultValue * 0.01
                                if (hp.currentValue == hp.defaultValue) return;
                                if (hp.currentValue > hp.defaultValue - (healAmt / 20)) {
                                    hp.setCurrentValue(hp.defaultValue)
                                } else {
                                    hp.setCurrentValue(hp.currentValue + (healAmt / 20))
                                }
                            }, j)
                        }

                        return;

                    }
                }
            }, i)
        }

    }
})

//minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id == "dungeons:despawn_corrupted_cauldron_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:teleport_out", loc)
        dim.playSound("mob.endermen.portal", loc, { pitch: 1, volume: 0.3 })
        entity.remove()

    } else if (id == "dungeons:spawn_corrupted_cauldron_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:teleport_in", loc)
        dim.playSound("mob.endermen.portal", loc, { pitch: 1.5, volume: 0.3 })
    }
});

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (!deadEntity) return;
    if (!deadEntity.isValid) return;
    if (deadEntity.matches({
        type: "dungeons:cauldron_slime"
    })) {
        system.runTimeout(() => {
            const dim = deadEntity.dimension;
            const loc = deadEntity.location;

            dim.spawnParticle("dungeons:teleport_out", loc)
            deadEntity.triggerEvent("dungeons:despawn")
            system.runTimeout(() => {
                const slimes = dim.getEntities({ location: loc, maxDistance: 3, type: "minecraft:slime" })
                for (const slime of slimes) {
                    if (slime.typeId == "minecraft:slime" && !slime.hasTag("dungeons:slimetag")) {

                        slime.remove()
                    }
                }
            }, 1)
        }, 16)
    }
})

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (!entity.typeId == "minecraft:slime") return;
    system.runTimeout(() => {
        if (entity.isValid) entity.addTag("dungeons:slimetag")
    }, 2)
})