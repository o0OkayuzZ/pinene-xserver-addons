import {
    world,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:reckless")) return;
    if (e.damageSource.cause == "selfDestruct") return;

    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 5 / 3
});

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingSet(attacker, "dungeons:reckless")) return;
    const baseDmg = e.damage;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause !== EntityDamageCause.entityAttack) {
        e.damage = e.damage * 1.25
    } else {
        e.damage = e.damage * 1.5
    }
});