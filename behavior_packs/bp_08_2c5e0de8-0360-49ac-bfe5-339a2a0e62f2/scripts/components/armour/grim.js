import {
    world
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingSet(attacker, "dungeons:grim_armour")) return;
    if (e.damage <= 0) return;
    var healAmt = e.damage * 0.05
    if (healAmt > 1.5) healAmt = 1.5
    let hp = attacker.getComponent("health")
    if (!hp) return;

    const maxHP = hp.defaultValue
    const currentHP = hp.currentValue;

    if (healAmt + currentHP > maxHP) {
        hp.setCurrentValue(maxHP)
    } else {
        hp.setCurrentValue(currentHP + healAmt)
    }

});