import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { addShadowForm } from "misc/shadowForm.js"

const effectId = "dungeons:shadow_shot_bow_effect"

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
    let hp = hurt.getComponent("health")
    if (!hp) return;
    if (hp.currentValue > 0) return;
    system.run(() => {
        const dim = hurt.dimension
        const hurtLoc = hurt.location;
        const loc = attacker.location
        dim.spawnParticle("dungeons:elixir_shadow", hurtLoc)
        dim.spawnParticle("dungeons:elixir_shadow", loc)
        dim.spawnParticle('dungeons:instant_teleport', attacker.getHeadLocation());
        dim.playSound('mob.endermen.portal', loc, { pitch: 0.6 });
        if (attacker.hasTag('dungeons:in_shadow_form')) {
            addShadowForm(attacker, 80)
        } else {
            addShadowForm(attacker, 140)

        }
    })


});