import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector, isValidTarget, specialDamage } from "main.js"

const effectId = "dungeons:fuse_shot_bow_effect"

function bowExplosion(projectile, attacker, loc, dim, particleType) {
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 3,
        excludeFamilies: ['ignore']
    });
    system.run(() => {
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === attacker) continue;
            var distanceBetween = Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)
            distanceBetween = Math.round(distanceBetween)
            const damageDone = specialDamage(attacker, target, 10 - distanceBetween, EntityDamageCause.entityExplosion, ["explosion"])
            if (!damageDone) continue;
            const dir = getDirection(loc, target.location);
            target.applyKnockback(makeVector(dir, 0.5), 0.23)
        }
        if (dim.isChunkLoaded(loc)) {
            dim.spawnParticle("dungeons:" + particleType + "_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
            dim.spawnParticle("dungeons:" + particleType + "_boom_dust", loc)
            dim.playSound("random.explode", loc, { pitch: 0.7 })
        }
        system.runTimeout(() => {

            if (projectile.isValid) projectile.remove()
        })
    })
}

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
    var particleId = "fuse_shot"
    if (projectile.hasTag("dungeons:purple_visuals_bow_effect")) particleId = "purple_fuse_shot"
    bowExplosion(projectile, attacker, projectile.location, projectile.dimension, particleId)
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
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    var particleId = "fuse_shot"
    if (projectile.hasTag("dungeons:purple_visuals_bow_effect")) particleId = "purple_fuse_shot"
    bowExplosion(projectile, player, e.location, e.dimension, particleId)
})