import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:cooldown_shot_bow_effect"

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
        const dim = attacker.dimension
        var sound = false
        const inventory = attacker.getComponent("inventory")
        if (!inventory) return;
        var cooldowns = []
        const container = inventory.container;
        for (let i = 0; i < container.size; i++) {
            const itemCheck = container.getItem(i)
            if (!itemCheck) continue;
            if (itemCheck.getComponent("dungeons:artefact_cooldown") == false) continue;
            const cooldown = itemCheck.getComponent("cooldown")
            if (!cooldown) continue;
            if (!cooldowns.includes(cooldown.cooldownCategory)) cooldowns.push(cooldown.cooldownCategory)
        }
        for (let i = 0; i < cooldowns.length; i++) {
            const cooldown = attacker.getItemCooldown(cooldowns[i])
            if (cooldowns[i].includes("spinblade")) continue;
            if (cooldown == 0) continue;
            var newCd = cooldown - 20
            if (newCd <= 0) newCd = 1
            attacker.startItemCooldown(cooldowns[i], newCd)
            sound = true
        }

        if (sound) dim.playSound("artefact.swiftness_boot.use", attacker.location, { pitch: 0.5 })
    })

});
