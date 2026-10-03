import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:wild_rage_bow_effect"

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
    if (Math.random() > 0.33) return;
    if (e.damage <= 0) return;
    if (!hurt.matches({ families: ["monster"] })) return;
    if (hurt.matches({ families: ["boss"] })) return;
    if (hurt.matches({ families: ["miniboss"] })) return;
    if (hurt.matches({ families: ["creeper"] })) return;
    system.run(() => {
        const findTarget = hurt.dimension.getEntities({ families: ["monster"], excludeFamilies: ["creeper"], location: hurt.location, maxDistance: 16, minDistance: 2 })
        if (findTarget.length < 1) return;
        var target = findTarget[0]

        hurt.dimension.spawnParticle('dungeons:death_cap_mushroom', hurt.location)
        hurt.addEffect('strength', 140, { showParticles: false })
        hurt.addEffect('speed', 140, { showParticles: false })
        hurt.applyDamage(0.01, { damagingEntity: target, cause: "override" })
        for (let i = 0; i < 28; i++) {
            system.runTimeout(() => {
                if (hurt.isValid) hurt.dimension.spawnParticle("dungeons:powershaker_idle", hurt.location)
            }, i * 5)
        }
    })
});