import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

import { stunnedEffect } from "misc/stunnedEffect.js"

const effectId = "dungeons:ranged_stunning_bow_effect"

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
    const spooky = projectile.hasTag("dungeons:webbed_bow_fired_by")
    if (e.damage <= 0) return;
    system.run(() => {
        const dim = hurt.dimension;
        const loc = hurt.location
        stunnedEffect(hurt, 30)
        if (spooky == true) {
            dim.spawnParticle("dungeons:webbed_bow", loc)
            dim.playSound("mob.player.hurt.freeze", loc, { pitch: 0.5 })
        }
    })

});