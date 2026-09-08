import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { isValidTarget, gravityTo } from "main.js"

const effectId = "dungeons:ranged_gravity_bow_effect"

function gravityPulse(targetLoc, dim, owner) {
    const gravityTargets = dim.getEntities({
        location: targetLoc,
        maxDistance: 6,
        minDistance: 0.5,
        excludeFamilies: ['ignore', 'gravity_immune']
    });
    system.run(() => {
        if (dim.isChunkLoaded(targetLoc)) {
            dim.spawnParticle("dungeons:ranged_gravity", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
            dim.playSound("mob.endermen.portal", targetLoc, { pitch: 0.65 })
        }
        for (const target of gravityTargets) {
            if (target == owner || isValidTarget(target) == false) continue;
            gravityTo(target, targetLoc)
        }
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
    gravityPulse(projectile.location, projectile.dimension, attacker)

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
    gravityPulse(projectile.location, projectile.dimension, player)
})