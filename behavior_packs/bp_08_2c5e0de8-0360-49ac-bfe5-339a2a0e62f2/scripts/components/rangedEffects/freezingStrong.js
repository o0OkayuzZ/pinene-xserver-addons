import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:ranged_freezing_strong_bow_effect"

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
        dim.spawnParticle("dungeons:stun_1s", loc)
        dim.playSound("ambient.weather.lightning.impact", loc, { volume: 0.33, pitch: 2.5 })
        hurt.applyKnockback({ x: 0, z: 0 }, -0.2)
        if (spooky == true) {
            dim.spawnParticle("dungeons:webbed_bow", loc)
            dim.playSound("mob.player.hurt.freeze", loc, { pitch: 0.5 })
        } else {
            dim.spawnParticle("dungeons:element_freeze", { x: loc.x, y: loc.y + 1, z: loc.z })
            dim.playSound("mob.player.hurt.freeze", loc)
        }
        if (!hurt.getEffect("slowness")) hurt.addEffect("slowness", 20, { amplifier: 60 })
        if (!hurt.getEffect("weakness")) hurt.addEffect("weakness", 20, { amplifier: 60 })
        system.runTimeout(() => {
            if (hurt.isValid == false) return;
            if (hurt.getEffect("slowness")) return;
            hurt.addEffect("slowness", 60, { amplifier: 2 })

        }, 20)
    })

});