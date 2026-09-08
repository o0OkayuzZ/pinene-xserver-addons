import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, getDirection, makeVector } from "main.js"

function crack(loc, dim) {
    dim.spawnParticle("dungeons:mooshroom_cracks", { x: loc.x, y: loc.y + 1, z: loc.z })
    dim.playSound("mob.ghast.fireball", loc, { pitch: 0.3 })
    dim.playSound("random.fuse", loc, { pitch: 1.2 })
    for (let i = 0; i < 50; i++) {
        system.runTimeout(() => {
            if (i % 5 == 0) dim.playSound("mob.ghast.fireball", loc, { pitch: 1.4 - (i / 50), volume: 0.2 })
            dim.spawnParticle("dungeons:lava_particle_mooshroom", { x: loc.x, y: loc.y, z: loc.z })
        }, i)
    }
    system.runTimeout(() => {
        dim.spawnParticle("dungeons:mooshroom_eruption_1", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:mooshroom_eruption_2", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:mooshroom_eruption_3", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:forge_core_dust", { x: loc.x, y: loc.y + 1, z: loc.z })

        dim.spawnParticle("dungeons:mooshroom_cracks_revert", { x: loc.x, y: loc.y + 1, z: loc.z })

        dim.playSound("mob.ghast.fireball", loc, { pitch: 0.5, volume: 2 })
        dim.playSound("random.explode", loc, { pitch: 0.33, volume: 2 })
        dim.spawnEntity("dungeons:angry_mooshroom", { x: loc.x, y: loc.y + 1, z: loc.z })
        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 5,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z))
                const damage = target.applyDamage(6 - distanceBetween, { cause: EntityDamageCause.magic });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.2 1")
                        target.runCommand("camerashake add @s 0.2 0.5")
                    }
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 1.2), 0.3)
                }
            }
        }
    }, 50)
}

//make cracks
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:mooshroom_monstrosity_lavacrack") {
        var loc = entity.location;
        const dim = entity.dimension;
        system.runTimeout(() => {
            const block = dim.getTopmostBlock({ x: loc.x + (Math.random() * 4), z: loc.z + (Math.random() * 4) }, loc.y)
            loc = { x: block.x, y: block.y + 0.01, z: block.z }
            if (block.typeId.includes("slab")) loc = { x: block.x, y: block.y - 0.45, z: block.z }


            crack(loc, dim)
        }, Math.floor(Math.random() * 20))
        entity.remove()
    }
});

//detect mooshroom
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:detect_mooshrooms' && entity.typeId == "dungeons:mooshroom_monstrosity") {
        const dim = entity.dimension;
        const loc = entity.location;
        if (!dim.isChunkLoaded(loc)) return;
        if (dim.getEntities({ location: loc, maxDistance: 64, families: ["mooshroom_minion"] }).length <= 0) {
            if (entity.getProperty("dungeons:mooshrooms") == true) entity.triggerEvent("dungeons:no_mooshrooms")
            entity.setProperty("dungeons:mooshrooms", false)
        } else {
            if (entity.getProperty("dungeons:mooshrooms") == false) entity.triggerEvent("dungeons:mooshrooms_exist")
            entity.setProperty("dungeons:mooshrooms", true)
        }
    }
});


//melee effect

function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 80)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    dim.playSound("random.break", targetLoc, { pitch: 0.6 })
    dim.spawnParticle("minecraft:critical_hit_emitter", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:melee_attack_used' && entity.typeId == "dungeons:mooshroom_monstrosity") {
        var loc = entity.location;
        const dim = entity.dimension;
        const vd = entity.getViewDirection();
        const impactPoint = { x: loc.x + vd.x * 5, y: loc.y + 0.2, z: loc.z + vd.z * 5 }
        dim.spawnParticle("dungeons:mooshroom_eruption_3", impactPoint)
        const damageRange = dim.getEntities({
            location: impactPoint,
            maxDistance: 5,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            var damage = false
            if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                if (target.matches({ families: ["monster"] })) continue;
                var distanceBetween = Math.round(Math.hypot(impactPoint.x - target.location.x, impactPoint.y - target.location.y, impactPoint.z - target.location.z)) * 2
                damage = target.applyDamage(16 - distanceBetween, { cause: EntityDamageCause.entityAttack });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.2 2.5")
                        target.runCommand("camerashake add @s 0.3 1.55")
                        target.runCommand("camerashake add @s 0.4 1.5")
                        target.runCommand("camerashake add @s 0.5 0.55")
                    }
                    const dir = getDirection(impactPoint, target.location);
                    target.applyKnockback(makeVector(dir, 1.7), 0.3)
                }
                if (target.typeId == "minecraft:player") {
                    const isShieldReady = target.getItemCooldown("minecraft:shield")
                    if (isShieldReady > 0) continue;
                    if (target.isSneaking == false) continue;
                    const equippable = target.getComponent("equippable")
                    if (!equippable) continue;
                    const mainHand = equippable.getEquipment("Mainhand")
                    if (mainHand !== undefined) {
                        if (mainHand.typeId == "minecraft:shield") {
                            const dir = getDirection(impactPoint, target.location);
                            if (!damage) target.applyKnockback(makeVector(dir, 1), 0.3)
                            disableShield(target)
                            continue;
                        }
                    }
                    const offhand = equippable.getEquipment("Offhand")
                    if (offhand !== undefined) {
                        if (offhand.typeId == "minecraft:shield") {
                            const dir = getDirection(impactPoint, target.location);
                            if (!damage) target.applyKnockback(makeVector(dir, 1), 0.3)
                            disableShield(target)
                            continue;
                        }
                    }
                }
            }
        }
    }
});

// projectiles
function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

/*world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    const cause = e.cause;
    if (cause !== "Spawned") return;
    if (entity.typeId == "dungeons:mushroom_rocket" && !entity.hasTag("dungeons:chud_projectile")) {

        const proj = entity.getComponent("projectile")
        if (!proj) return;
        const owner = proj.owner;
        if (!owner) return;
        if (owner.typeId == "dungeons:mooshroom_monstrosity") {
            const dim = owner.dimension;
            const viewDir = owner.getViewDirection()
            let amount = 3
            for (let i = 0; i < amount; i++) {
                const angle = (-((amount - 1) / 2 * 20) + 20 * i) / 2;

                const radians = angle * (Math.PI / 180)
                if (angle == 0) continue;
                world.sendMessage(`${angle}`)
                const hd = entity.location;
                const vd = owner.getViewDirection();
                const projectile = dim.spawnEntity(entity.typeId, { x: hd.x + vd.x, y: hd.y + vd.y, z: vd.z + hd.z })
                const comp = projectile.getComponent('projectile');
                let cosTheta = Math.cos(radians);
                let sinTheta = Math.sin(radians);
                const direction = {
                    x: viewDir.x * cosTheta + viewDir.z * sinTheta,
                    y: viewDir.y,
                    z: -viewDir.x * sinTheta + viewDir.z * cosTheta
                }
                if (comp) {
                    comp.owner = owner
                    comp.shoot(multiply(direction, { x: 1.6, y: 1.6, z: 1.6 }))
                } else {
                    projectile.applyImpulse(multiply(direction, { x: 1.6, y: 1.6, z: 1.6 }))
                }
                projectile.addTag("dungeons:chud_projectile")
            }

        } else {
            return;
        }
    }
})*/

function mushroomExplosion(loc, dim, owner, projectile) {
    var baseDamage = 20
    if (world.getDifficulty() == "Easy") baseDamage = baseDamage - 8
    if (world.getDifficulty() == "Normal") baseDamage = baseDamage - 4
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 6,
        excludeFamilies: ['ignore']
    });
    system.run(() => {
        for (const target of damageRange) {
            if (target.isValid == false) continue;
            if (target.matches({ families: ["mooshroom_minion"] })) continue;
            if (target == owner) continue;
            var distanceBetween = Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)
            distanceBetween = Math.round(distanceBetween)
            const dir = getDirection(loc, target.location);
            const damageDone = target.applyDamage(baseDamage - distanceBetween, { damagingEntity: owner, cause: EntityDamageCause.entityExplosion })
            if (damageDone) {
                target.applyKnockback(makeVector(dir, (6 - distanceBetween)), 1)
            }
        }
        if (dim.isChunkLoaded(loc)) {
            dim.spawnParticle("dungeons:mushroom_rocket_explosion", loc)
            dim.spawnParticle("dungeons:forge_core_dust", loc)
            dim.spawnParticle("dungeons:redstone_eruption_3", loc)
            dim.playSound("random.explode", loc, { pitch: 0.7 })
        }
        system.run(() => {
            if (projectile.isValid) projectile.remove()
        })
    })
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const mob = e.entity;
    const eventId = e.eventId;
    if (eventId !== 'dungeons:mushroom_rocket_explode') {
        return;
    }
    if (!mob.isValid) return;
    const owner = mob.getComponent('minecraft:projectile').owner;
    mushroomExplosion(mob.location, mob.dimension, owner, mob)
    mob.remove()
});

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == "dungeons:mushroom_rocket") {
        if (entity.isValid == false) return;
        const proj = entity.getComponent("minecraft:projectile")
        mushroomExplosion(loc, dim, proj.owner, entity)
        entity.remove()
    }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
    const entity = e.projectile;
    const hit = e.getEntityHit().entity
    if (!hit.isValid) return;
    const dim = hit.dimension
    const loc = e.location;
    if (entity.typeId == "dungeons:mushroom_rocket") {
        system.runTimeout(() => {
            if (entity.isValid) entity.remove()
        }, 100)
        if (!entity.isValid) return;
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner || !owner.isValid) {
            entity.remove()
            return;
        }
        if (!hit.matches({ families: ["mooshroom_minion"] })) {
            hit.applyDamage(20, { damagingEntity: owner, cause: EntityDamageCause.entityExplosion })
        }
        mushroomExplosion(loc, dim, owner, entity)
        entity.remove()
    }
})
