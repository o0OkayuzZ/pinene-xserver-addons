import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:ranged_enigma_resonator_bow_effect"

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

    const critical = Math.floor(Math.random() * 400);
    var souls = world.scoreboard.getObjective('soulGauge').getScore(attacker);
    if (souls > 100) souls = 100
    if (critical < souls) {
        e.damage = e.damage * 2
        system.run(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            dim.spawnParticle("dungeons:enigma_skull_crit", hurtLoc)
            dim.spawnParticle("dungeons:enigma_skull_burst", hurtLoc)
            dim.playSound("random.anvil_land", hurtLoc, { volume: 0.7, pitch: 1.5 })
        })
    }

});