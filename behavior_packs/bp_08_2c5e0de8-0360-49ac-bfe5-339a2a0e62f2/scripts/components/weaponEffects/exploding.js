import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage, isValidTarget } from "main.js";

const effectId = "dungeons:exploding"



world.afterEvents.entityDie.subscribe((e) => {
    const hurt = e.deadEntity;
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
    let hp = hurt.getComponent('minecraft:health')

    if (!hp) {
        console.warn('Entity does not have health component');
        return;
    }
    system.runTimeout(() => {
        if (!hurt.isValid) return;
        if (!attacker.isValid) return;
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
            target.addTag("dungeons:area_hit")
            system.runTimeout(() => {
                if (target.isValid) target.removeTag("dungeons:area_hit")
            }, 1)
            const damageDone = specialDamage(attacker, target, hp.defaultValue * 0.33, EntityDamageCause.entityAttack, ["weapon"])
            if (!damageDone) continue;
            target.applyKnockback({ x: 0, z: 0 }, 0.3)
        }
        dim.spawnParticle("dungeons:explosion_smoke", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
        dim.spawnParticle("dungeons:explosion_dust", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
        dim.playSound("random.explode", targetLoc, { pitch: 0.7 })
        dim.playSound("weapon.enchant.exploding", targetLoc)
    }, 18) // waits 0.9 seconds for death to finish

});