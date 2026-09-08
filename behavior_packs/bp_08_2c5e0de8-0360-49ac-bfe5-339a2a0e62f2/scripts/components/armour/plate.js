import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:plate_armour")) return;

    if (e.damageSource.cause == "selfDestruct") return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
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
system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:plate_armour")) {
            if (player.isSprinting) player.addEffect("slowness", 4, { amplifier: 1, showParticles: false });
        }
    }
});