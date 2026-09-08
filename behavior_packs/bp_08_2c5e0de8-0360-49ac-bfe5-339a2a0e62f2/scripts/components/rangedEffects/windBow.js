import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector } from "main.js"

const effectId = "dungeons:windpull_bow_effect"

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
    const targetLoc = hurt.location
    const dim = hurt.dimension;
    const direction = getDirection(targetLoc, attacker.location);
    var strength = direction.y * 0.5 + 0.5
    system.run(() => {
        if (strength < 4) {
            hurt.applyKnockback(makeVector(direction, 3 + (strength * 3)), strength);
        } else {
            hurt.applyKnockback(makeVector(direction, 3 + (strength * 3)), strength);
        }
        dim.spawnParticle('minecraft:wind_explosion_emitter', { x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z });
        dim.playSound('wind_charge.burst', targetLoc, { volume: 0.9, pitch: 1 });
    })

});