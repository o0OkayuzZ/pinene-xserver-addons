import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:shared_pain_v2"

import { isValidTarget, specialDamage, gravityTo } from "main.js";


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
    var count = 0
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    if (e.damage <= 0) return;
    const hp = hurt.getComponent("minecraft:health")
    if(hp.currentValue >= 0) return;
    const overkill = Math.abs(hp.currentValue)
    world.sendMessage(`${Math.ceil(overkill*100)/100}`)
    const dim = hurt.dimension;
    const loc = hurt.location
    system.run(() => {
        if(!hurt.isValid) return;
        if(hp.currentValue > 0) return;
        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 7,
            excludeFamilies: ['ignore']
        });

        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === hurt) continue;
            if (target === attacker) continue;
            target.applyDamage(overkill, {cause: EntityDamageCause.entityAttack, damagingEntity: attacker})
        }
    })
});