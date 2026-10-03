import {
    world,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:thorns")) return;
    if (e.damageSource.cause == "selfDestruct") return;
    if (e.damageSource.cause == EntityDamageCause.thorns) return;
    if (Math.random() > 0.4) return;
    attacker.applyDamage(e.damage, { cause: EntityDamageCause.thorns, damagingEntity: hurt })
});