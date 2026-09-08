import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage, isValidTarget, getDirection, makeVector } from "main.js";

const effectId = "dungeons:whip"

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
    if (hurt.hasTag("dungeons:area_hit")) return;
    const originLoc = attacker.location
    const targetLoc = hurt.location;
    var distanceBetween = Math.hypot(originLoc.x - targetLoc.x, originLoc.y - targetLoc.y, originLoc.z - targetLoc.z)
    distanceBetween = Math.ceil(distanceBetween)
    e.damage = e.damage = e.damage * (1 + (distanceBetween / Math.round(1 + e.damage)))
    system.runTimeout(() => {
        const dim = hurt.dimension
        const damageRange = dim.getEntities({
            location: targetLoc,
            maxDistance: 1.66,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === hurt) continue;
            if (target === attacker) continue;
            target.addTag("dungeons:area_hit")
            system.runTimeout(() => {
                if (target.isValid) target.removeTag("dungeons:area_hit")
            }, 1)
            const damageDone = specialDamage(attacker, target, 5 + distanceBetween, EntityDamageCause.entityAttack, ["weapon", "apply_melee_enchants", "apply_strength", "apply_weakness"])
            if (!damageDone) continue;
            target.applyKnockback({ x: 0, z: 0 }, 0.2)
        }
    }, 5)
});