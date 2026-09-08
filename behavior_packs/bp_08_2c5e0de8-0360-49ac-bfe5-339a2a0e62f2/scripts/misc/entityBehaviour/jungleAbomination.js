import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";


//projectiles
world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == "dungeons:jungle_dart") {
        if (!entity.isValid) return;
        entity.remove()
        return;
    }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
    const entity = e.projectile;
    const hit = e.getEntityHit().entity
    if (!hit.isValid) return;
    const dim = hit.dimension
    const loc = e.location;
    if (entity.typeId == "dungeons:jungle_dart") {
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
        if (hit.matches({ families: ["undead"] })) return;
        if (hit.matches({ families: ["monster"] })) return;
        if (hit.matches({ families: ["ignore"] })) return;
        if (hit.matches({ families: ["inanimate"] })) return;
        hit.addEffect("poison", 60, { amplifier: 2 })
        hit.applyDamage(1.5, { damagingEntity: owner, cause: EntityDamageCause.magic })


        entity.remove()
    }
})
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (projectile.typeId !== "dungeons:jungle_dart") return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;

    if (hit.matches({ families: ["undead"] }) || hit.matches({ families: ["monster"] })) {
        e.cancel = true;
        e.damage = 0
    }

});

function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}

function shoot(entity, amount) {
    const nearestPlayer = entity.dimension.getPlayers({ closest: 1, location: entity.location, maxDistance: 64, excludeGameModes: ["Spectator"] })
    if (nearestPlayer.length > 0) entity.lookAt(nearestPlayer[0].location)
    const dim = entity.dimension;
    const viewDir = entity.getViewDirection()
    for (let i = 0; i < amount; i++) {
        var angle = -((amount - 1) / 2 * 10) + 10 * i;
        angle = angle * 1.5
        const radians = angle * (Math.PI / 180)
        //if (angle == 0) continue;
        const hd = entity.getHeadLocation();
        const vd = entity.getViewDirection();
        const projectile = dim.spawnEntity("dungeons:jungle_dart", { x: hd.x + vd.x, y: entity.location.y + 1.5, z: vd.z + hd.z })
        const comp = projectile.getComponent('projectile');
        let cosTheta = Math.cos(radians);
        let sinTheta = Math.sin(radians);
        const direction = {
            x: viewDir.x * cosTheta + viewDir.z * sinTheta,
            y: 0,
            z: -viewDir.x * sinTheta + viewDir.z * cosTheta
        }
        if (comp) {
            comp.owner = entity
            comp.shoot(multiply(direction, { x: 0.8, y: 1, z: 0.8 }))
        } else {
            projectile.applyImpulse(multiply(direction, { x: 0.8, y: 1, z: 0.8 }))
        }
        projectile.addTag("dungeons:chud_projectile")
        system.runTimeout(() => {
            if (projectile.isValid) projectile.remove()
        }, 200)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:ranged_attack_plan' && entity.typeId == "dungeons:jungle_abomination") {
        system.runTimeout(() => {
            if (entity.isValid && entity.getProperty("dungeons:jungle_darts")) shoot(entity, 13)
        }, 15)
        system.runTimeout(() => {

            if (entity.isValid && entity.getProperty("dungeons:jungle_darts")) shoot(entity, 13)
        }, 50)
    }
});




//melee effect
import { isValidTarget, getDirection, makeVector } from "main.js"

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
    if (id === 'dungeons:melee_attack_used' && entity.typeId == "dungeons:jungle_abomination") {
        var loc = entity.location;
        const dim = entity.dimension;
        const vd = entity.getViewDirection();
        const impactPoint = { x: loc.x + vd.x * 5, y: loc.y + 0.2, z: loc.z + vd.z * 5 }
        dim.spawnParticle("dungeons:abomination_slam_1", impactPoint)
        dim.spawnParticle("dungeons:abomination_slam_2", impactPoint)
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
                damage = target.applyDamage(20 - distanceBetween, { cause: EntityDamageCause.entityAttack });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.2 2.5")
                        target.runCommand("camerashake add @s 0.3 1.55")
                        target.runCommand("camerashake add @s 0.4 1.5")
                        target.runCommand("camerashake add @s 0.5 0.55")
                    }
                }
                const dir = getDirection(impactPoint, target.location);
                target.applyKnockback(makeVector(dir, 2), 0.3)
                target.addEffect("poison", 40, { amplifier: 1 })
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


//vines

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:quick_vine_circle' && entity.typeId == "dungeons:abomination_vinemarker") {
        var loc = entity.location;
        const dim = entity.dimension;
        system.runTimeout(() => {
            const block = dim.getTopmostBlock({ x: loc.x + (Math.random() * 2), z: loc.z + (Math.random() * 2) }, loc.y)
            loc = { x: block.x, y: block.y + 1.01, z: block.z }
            loc = { x: loc.x, y: Math.floor(loc.y), z: loc.z }

            dim.spawnParticle("dungeons:abomination_warn_1", loc)
            system.runTimeout(() => {
                const damageRange = dim.getEntities({
                    location: loc,
                    maxDistance: 3,
                    excludeFamilies: ['ignore', "monster"]
                });
                for (const target of damageRange) {
                    if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                        var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 3
                        const damage = target.applyDamage(20 - distanceBetween, { cause: EntityDamageCause.entityExplosion });
                        if (damage) {
                            if (target.typeId == "minecraft:player") {
                                target.runCommand("camerashake add @s 0.3 2")
                                target.runCommand("camerashake add @s 0.3 1.5")
                                target.runCommand("camerashake add @s 0.3 1")
                                target.runCommand("camerashake add @s 0.3 0.5")
                            }
                            const dir = getDirection(loc, target.location);
                            target.applyKnockback(makeVector(dir, 1.2), 0.3)
                        }
                    }
                }
                dim.spawnParticle("dungeons:abomination_warn_2", loc)
                dim.spawnEntity("dungeons:abomination_vine", loc)
            }, 35)
        }, Math.floor(Math.random() * 10))
        entity.remove()
    }

    if (id === 'dungeons:quick_vine' && entity.typeId == "dungeons:abomination_vinemarker") {
        var loc = entity.location;
        const dim = entity.dimension;
        system.runTimeout(() => {
            const block = dim.getTopmostBlock({ x: loc.x + (Math.random() * 2), z: loc.z + (Math.random() * 2) }, loc.y)
            loc = { x: block.x, y: block.y + 1.01, z: block.z }
            loc = { x: loc.x, y: Math.floor(loc.y), z: loc.z }

            dim.spawnParticle("dungeons:abomination_warn_1", loc)
            system.runTimeout(() => {
                const damageRange = dim.getEntities({
                    location: loc,
                    maxDistance: 3,
                    excludeFamilies: ['ignore', "monster"]
                });
                for (const target of damageRange) {
                    if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                        var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 3
                        const damage = target.applyDamage(11 - distanceBetween, { cause: EntityDamageCause.entityExplosion });
                        if (damage) {
                            if (target.typeId == "minecraft:player") {
                                target.runCommand("camerashake add @s 0.3 2")
                                target.runCommand("camerashake add @s 0.3 1.5")
                                target.runCommand("camerashake add @s 0.3 1")
                                target.runCommand("camerashake add @s 0.3 0.5")
                            }
                            const dir = getDirection(loc, target.location);
                            target.applyKnockback(makeVector(dir, 1.2), 0.3)
                        }
                    }
                }

                dim.spawnParticle("dungeons:abomination_warn_2", loc)
                dim.spawnEntity("dungeons:abomination_quick_vine", loc)
            }, 20)
        }, 1 + Math.floor(Math.random() * 5))

        entity.remove()
    }
});



//rage

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:jungle_rage' && entity.typeId == "dungeons:jungle_abomination") {
        const dim = entity.dimension;
        const loc = entity.location;
        entity.playAnimation("animation.jungle_abomination_v2.roar")
        dim.spawnParticle("dungeons:abomination_roar", loc)
        entity.addEffect("speed", 999999, { showParticles: false })
        entity.addEffect("strength", 999999, { showParticles: false })


        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 10,
            excludeFamilies: ['ignore', "monster"]
        });
        for (const target of damageRange) {
            if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 1.6
                const damage = target.applyDamage(20 - distanceBetween, { cause: EntityDamageCause.entityAttack });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.3 2")
                        target.runCommand("camerashake add @s 0.3 1.5")
                        target.runCommand("camerashake add @s 0.3 1")
                        target.runCommand("camerashake add @s 0.3 0.5")
                    }
                    target.addEffect("poison", 200)
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 2), 0.3)
                }
            }
        }
    }
});

//minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id == "dungeons:despawn_jungle_abomination_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:teleport_out", loc)
        dim.playSound("mob.endermen.portal", loc, { pitch: 1, volume: 0.3 })
        entity.remove()

    } else if (id == "dungeons:spawn_jungle_abomination_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:teleport_in", loc)
        dim.playSound("mob.endermen.portal", loc, { pitch: 1.5, volume: 0.3 })
    }
});