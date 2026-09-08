import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:champions_armour")) return;
    if (e.damageSource.cause !== EntityDamageCause.entityAttack) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = e.damage * 0.8
    if (hurt.getDynamicProperty("dungeons:damage_reduction_prevented") >= baseDmg) {
        e.cancel = true;
        return;
    }
    hurt.setDynamicProperty("dungeons:damage_reduction_prevented", baseDmg)
    system.runTimeout(() => {
        hurt.setDynamicProperty("dungeons:damage_reduction_prevented", null)
    }, 9)
});