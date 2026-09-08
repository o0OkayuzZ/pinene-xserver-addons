import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { isValidTarget } from "main.js";

const effectId = "dungeons:weakening"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && heldItem.getDynamicProperty("dungeons:gild") !== effectId) return;
    //effect code
    if (e.damage <= 0) return;
    system.run(() => {
        if (hurt.getEffect("weakness")) return;
        hurt.addEffect("weakness", 150)
        hurt.dimension.spawnParticle('dungeons:cauldron_summon', {
            x: hurt.location.x,
            y: hurt.location.y + 1,
            z: hurt.location.z
        });
        const dim = attacker.dimension;
        const targetLoc = hurt.location
        const damageRange = dim.getEntities({
            location: targetLoc,
            maxDistance: 5,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === hurt) continue;
            if (target === attacker) continue;
            target.addEffect("weakness", 100)
        }
    })
});