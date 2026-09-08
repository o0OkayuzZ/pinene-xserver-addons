import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:ranged_critical_hit_bow_effect"

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

    const critical = Math.floor(Math.random() * 7);
    if (critical == 1) {
        e.damage = e.damage * 2
        system.run(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            dim.spawnParticle("dungeons:skull_crit", hurtLoc)
            dim.spawnParticle("dungeons:skull_burst", hurtLoc)
            dim.playSound("random.anvil_land", hurtLoc, { volume: 0.7, pitch: 1.5 })
        })
    }

});