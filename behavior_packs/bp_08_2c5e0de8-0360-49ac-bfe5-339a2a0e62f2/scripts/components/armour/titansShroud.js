import {
    world,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingSet(attacker, "dungeons:titans_shroud")) return;
    if (e.damageSource.cause !== EntityDamageCause.entityAttack) return;
    const baseDmg = e.damage;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 1.1
});