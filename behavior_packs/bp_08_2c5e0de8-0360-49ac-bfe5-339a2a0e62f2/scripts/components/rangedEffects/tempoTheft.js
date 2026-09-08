import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:tempo_theft_bow_effect"

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
    system.run(() => {
        let slowness = hurt.getEffect("slowness");
        let speed = attacker.getEffect("speed");
        if (!slowness) {
            hurt.addEffect("slowness", 60, { amplifier: 0 })
        } else {
            var slowLevel = slowness.amplifier + 1;
            if (slowLevel > 5) slowLevel = 5
            var slowTime = slowness.duration + 25;
            if (slowTime > 155) slowTime = 155
            hurt.addEffect("slowness", slowTime, { amplifier: slowLevel })

        }
        if (!speed) {
            attacker.addEffect("speed", 60, { amplifier: 0 })
        } else {
            var speedLevel = speed.amplifier + 1;
            if (speedLevel > 5) speedLevel = 5
            var speedTime = speed.duration + 25;
            if (speedTime > 155) speedTime = 155
            attacker.addEffect("speed", speedTime, { amplifier: speedLevel })

        }
        const dim = attacker.dimension;
        const loc = attacker.location
        dim.playSound("artefact.swiftness_boot.use", loc)
        dim.spawnParticle('dungeons:swiftness', loc)
    })

});