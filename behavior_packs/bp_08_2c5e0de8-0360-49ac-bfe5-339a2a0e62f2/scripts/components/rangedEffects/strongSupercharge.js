import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector } from "main.js"

const effectId = "dungeons:strong_supercharge_bow_effect"

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
    const v = projectile.getVelocity()
    var x = v.x
    if (x < 0) x = x * -1
    var z = v.z
    if (z < 0) z = z * -1
    var y = v.y
    if (y < 0) y = y * -1
    const damageBuff = Math.round((x + y + z) / 1)
    e.damage = e.damage = e.damage * (1 + (damageBuff / Math.round(1 + e.damage)))
    const dir = getDirection(projectile.location, hurt.location)
    system.run(() => {
        hurt.applyKnockback(makeVector(dir, damageBuff / 1.5), 0.33)
    })
});