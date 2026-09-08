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
    if (!isWearingSet(hurt, "dungeons:shulker_armour")) return;
    const attacker = e.damageSource.damagingEntity;
    var nearbyTargets = 0
    for (const mob of hurt.dimension.getEntities({ location: hurt.location, maxDistance: 8 })) {
        if (attacker && mob.typeId == attacker.typeId) {
            nearbyTargets += 1
            continue;
        }
        if (mob.matches({ families: ["monster"] })) nearbyTargets += 1
    }
    if (nearbyTargets < 4) return;
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


world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:shulker_armour")) return;
    if (e.damageSource.cause !== EntityDamageCause.projectile) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = e.damage * 2 / 3
    if (hurt.getDynamicProperty("dungeons:damage_reduction_prevented") >= baseDmg) {
        e.cancel = true;
        return;
    }
    hurt.setDynamicProperty("dungeons:damage_reduction_prevented", baseDmg)
    system.runTimeout(() => {
        hurt.setDynamicProperty("dungeons:damage_reduction_prevented", null)
    }, 9)
});