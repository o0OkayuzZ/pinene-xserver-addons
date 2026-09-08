import {
    world,
    system,
    EntityDamageCause,
    DimensionTypes
} from "@minecraft/server";


import { arrowTypes, playShootSound } from "components/ranged.js"
import { getDirection, makeVector, isValidTarget, specialDamage } from "main.js"

function bowExplosion(projectile, attacker, loc, dim) {
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 6,
        excludeFamilies: ['ignore']
    });
    system.run(() => {
        for (const target of damageRange) {
            var baseDamage = 21
            if (attacker) {
                if (attacker.typeId == "minecraft:player") {
                    if (!target.isValid) continue;
                    if (isValidTarget(target) == false && target !== attacker) continue;
                } else {
                    if (world.getDifficulty() == "Easy") baseDamage = baseDamage - 3
                    if (world.getDifficulty() == "Normal") baseDamage = baseDamage - 1
                    baseDamage = baseDamage - 2
                    if (!target.isValid) continue;
                    if (!target.matches({ families: ["player"] })) continue;
                }
            } else {
                if (world.getDifficulty() == "Easy") baseDamage = baseDamage - 3
                if (world.getDifficulty() == "Normal") baseDamage = baseDamage - 1
                baseDamage = baseDamage - 2
                if (!target.isValid) continue;
                if (!target.matches({ families: ["player"] }) && !target.matches({ families: ["mob"] }) && !target.matches({ families: ["monster"] })) continue;

            }
            var distanceBetween = Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)
            distanceBetween = Math.round(distanceBetween)
            const dir = getDirection(loc, target.location);
            if (attacker) {
                if (target == attacker) {
                    const damageDone = specialDamage(attacker, target, (baseDamage / 2) - distanceBetween, EntityDamageCause.fireworks, ["explosion"])
                    if (damageDone || attacker.getGameMode() == "Creative") target.applyKnockback(makeVector(dir, (6 - distanceBetween)), 8 / (4 + distanceBetween * distanceBetween))
                    continue;
                } else {
                    const damageDone = specialDamage(attacker, target, baseDamage - distanceBetween, EntityDamageCause.fireworks, ["explosion"])
                    if (damageDone) target.applyKnockback(makeVector(dir, (6 - distanceBetween)), 6 / (4 + distanceBetween * distanceBetween))
                }
            } else {
                const damageDone = target.applyDamage(baseDamage - distanceBetween, { cause: EntityDamageCause.fireworks })
                if (damageDone) {
                    target.applyKnockback(makeVector(dir, (6 - distanceBetween)), 6 / (4 + distanceBetween * distanceBetween))
                }
            }

        }
        if (dim.isChunkLoaded(loc)) {
            dim.spawnParticle("dungeons:firework_arrow_2", { x: loc.x, y: loc.y - 0.2, z: loc.z })
            //dim.spawnParticle("dungeons:firework_arrow_1", loc)
            dim.spawnParticle("dungeons:firework_arrow_0", loc)
            dim.playSound("random.explode", loc, { pitch: 1.1 })
            dim.playSound("firework.twinkle", loc, { pitch: 1.1 })
        }
        system.run(() => {

            if (projectile.isValid) projectile.remove()
        })
    })

}


function lightStrike(projectile, hurtLoc, projLoc, attacker, damage, dim, hurt, range) {
    if (projectile.isValid) projectile.addTag("dungeons:shocked_arrow")
    const damageRange = dim.getEntities({
        location: hurtLoc,
        maxDistance: range,
        excludeFamilies: ['ignore']
    });
    var count = 0
    for (const target of damageRange) {
        if (count > 3) break;
        if (attacker) {
            if (attacker.typeId == "minecraft:player") {
                if (isValidTarget(target) == false) continue;
            } else {
                if (!target.isValid) continue;
                if (!target.matches({ families: ["player"] })) continue;
            }
        } else {
            if (!target.isValid) continue;
            if (!target.matches({ families: ["player"] }) && !target.matches({ families: ["mob"] }) && !target.matches({ families: ["monster"] })) continue;

        }
        if (target === hurt) continue;
        if (target === attacker) continue;
        var damageDone = false
        if (attacker) {
            damageDone = specialDamage(attacker, target, 2 + damage / 2, EntityDamageCause.lightning, ["lightning"])

        } else {
            damageDone = target.applyDamage(2 + damage / 2, { cause: EntityDamageCause.lightning })
        }
        if (damageDone) {
            target.applyKnockback({ x: 0, z: 0 }, -0.1)
            count += 1
            dim.playSound("weapon.enchant.thundering", target.location)
            //dim.spawnParticle("dungeons:lightning_wand_shock", target.location)
        }
    }
    if (count > 0) {
        dim.spawnParticle("dungeons:lightning_wand_shock", projLoc)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const mob = e.entity;
    const eventId = e.eventId;
    if (eventId !== 'dungeons:firework_explosion') {
        return;
    }
    if (!mob.isValid) return;
    const owner = mob.getComponent('minecraft:projectile').owner;
    bowExplosion(mob, owner, mob.location, mob.dimension)
});

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    var attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (arrowTypes.includes(attacker.typeId)) attacker = undefined
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    const dim = hurt.dimension
    const hurtLoc = hurt.location
    const projLoc = projectile.location
    if (projectile.typeId == "dungeons:torment_arrow") {
        if (e.damage < 10) e.damage * 3
        const dir = getDirection(projLoc, hurtLoc)
        system.run(() => {
            hurt.applyKnockback(makeVector(dir, 1.5), 0.08)
        })
    } else if (projectile.typeId == "dungeons:burning_arrow") {
        system.run(() => {
            hurt.setOnFire(3 + e.damage / 2)
        })
    } else if (projectile.typeId == "dungeons:thundering_arrow") {
        if (projectile.hasTag("dungeons:shocked_arrow") == false) {
            system.run(() => {
                lightStrike(projectile, hurtLoc, projLoc, attacker, e.damage, dim, hurt, 6)
            })
        }
    } else if (projectile.typeId == "dungeons:firework_arrow") {
        if (e.damage < 12) e.damage * 1.7
        bowExplosion(projectile, attacker, projLoc, dim)
        system.run(() => {
            if (projectile.isValid) projectile.remove()
        })
    }
});

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const projectile = e.projectile
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const player = e.source;
    /*if (!player) return;
    if (!player.isValid) return;*/
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    const dim = e.dimension
    const hurtLoc = e.location
    const projLoc = e.location
    if (projectile.typeId == "dungeons:thundering_arrow") {
        if (projectile.hasTag("dungeons:shocked_arrow") == false) {
            system.run(() => {
                lightStrike(projectile, hurtLoc, projLoc, player, 5, dim, undefined, 4)
            })
        }
    } else if (projectile.typeId == "dungeons:firework_arrow") {
        system.run(() => {
            if (player) bowExplosion(projectile, player, projectile.location, projectile.dimension)
            if (!player) bowExplosion(projectile, undefined, projectile.location, projectile.dimension)
        })
    }
})

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (arrowTypes.includes(entity.typeId) == false) return;
    system.runTimeout(() => {
        if (entity.isValid) entity.addTag("dungeons:crossbow_checked")
    }, 5)
    const cause = e.cause;
    if (cause !== "Spawned") return;
    const proj = entity.getComponent("projectile")
    if (!proj) return;
    const owner = proj.owner;
    if (!owner) {
        entity.dimension.playSound(entity.typeId.replace("dungeons:", "projectile."), entity.location)
    } else {
        if (entity.typeId == "dungeons:firework_arrow" && !owner.isSneaking) {
            if (!entity.hasTag("dungeons:chain_reaction_arrow") && !entity.hasTag("dungeons:ricochet_arrow") && !entity.hasTag("dungeons:reliable_ricochet_arrow")) {
                const vd = owner.getViewDirection()
                if (entity.hasTag("dungeons:multishot_arrow")) owner.applyImpulse({ x: vd.x * -0.2, y: vd.y * -0.2, z: vd.z * -0.2 })
                if (!entity.hasTag("dungeons:multishot_arrow")) owner.applyImpulse({ x: vd.x * -0.66, y: vd.y * -0.66, z: vd.z * -0.66 })
            }
        }
        playShootSound(owner, entity.typeId.replace("dungeons:", "projectile."))
    }
})