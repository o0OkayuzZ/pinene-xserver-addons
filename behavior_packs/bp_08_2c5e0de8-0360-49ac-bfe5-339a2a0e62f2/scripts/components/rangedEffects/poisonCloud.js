import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector, isValidTarget, specialDamage } from "main.js"

const effectId = "dungeons:poison_cloud_ranged_bow_effect"


world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (!projectile.hasTag(effectId)) return;
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    if (Math.random() <= 0.25) {
        system.run(() => {
            var cd = world.scoreboard.getObjective('dungeons:poison_cloud_ranged_t');
            if (!cd) {
                cd = world.scoreboard.addObjective('dungeons:poison_cloud_ranged_t');
            }
            if (cd.hasParticipant(attacker.scoreboardIdentity)) {
                return;
            }
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            system.runTimeout(() => {
                cd.setScore(attacker, 80)
            }, 5)
            dim.playSound('weapon.enchant.poison', hurtLoc)
            createPoisonCloud(5 * 2, dim, hurtLoc, attacker)
        })
    }

});

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const projectile = e.projectile
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const player = e.source;
    if (!player) return;
    if (!player.isValid) return;
    if (!projectile.hasTag(effectId)) return;
    if (!projectile.hasTag(effectId.replace("dungeons:", "dungeons:nongilded_")) && Math.random() > 0.5) return;
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    if (Math.random() <= 0.25) {
        system.run(() => {
            var cd = world.scoreboard.getObjective('dungeons:poison_cloud_ranged_t');
            if (!cd) {
                cd = world.scoreboard.addObjective('dungeons:poison_cloud_ranged_t');
            }
            if (cd.hasParticipant(player.scoreboardIdentity)) {
                return;
            }
            const dim = projectile.dimension
            const hurtLoc = projectile.location;
            cd.setScore(player, 80)
            dim.playSound('weapon.enchant.poison', hurtLoc)
            createPoisonCloud(5 * 2, dim, hurtLoc, player)
        })
    }

});


// cloud
function createPoisonCloud(timeLeft, dim, loc, owner) {
    if (timeLeft <= 0) return;
    if (timeLeft > 1) {
        dim.spawnParticle("dungeons:poison_cloud_smoke", loc)
        dim.spawnParticle("dungeons:poison_cloud_swirls", loc)
    }
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 4,
        excludeFamilies: ['ignore']
    });
    for (const target of damageRange) {
        if (isValidTarget(target) == false) continue;
        if (target === owner) continue;
        var damage = 3
        if (target.typeId !== "minecraft:player") damage += 1
        const damageDone = specialDamage(owner, target, damage, EntityDamageCause.magic, ["poison"])
        if (damageDone) {
            target.applyKnockback({ x: 0, z: 0 }, -0.1)
            if (damage <= 3) target.addEffect("poison", 11)
            if (damage > 3) target.addEffect("fatal_poison", 11)
        }
    }
    system.runTimeout(() => {
        createPoisonCloud(timeLeft - 1, dim, loc, owner)
    }, 10)
}