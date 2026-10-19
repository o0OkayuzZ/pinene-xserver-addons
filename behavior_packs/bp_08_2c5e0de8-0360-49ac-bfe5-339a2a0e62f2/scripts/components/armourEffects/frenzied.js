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
    const attacker = e.damageSource.damagingEntity;

    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") return;
    if (!isWearingSet(attacker, "dungeons:frenzied")) return;
    const hp = attacker.getComponent("health")
    if (!hp) return;
    if (hp.currentValue > hp.effectiveMax / 2) return;
    if (e.damageSource.cause !== EntityDamageCause.entityAttack) return;
    const baseDmg = e.damage;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 1.2
});

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:frenzied")) {
            const hp = player.getComponent("health")
            if (!hp) continue;
            if (hp.currentValue > hp.effectiveMax / 2) continue;
            player.addEffect("speed", 4, { amplifier: 0, showParticles: false });
        }
    }
}, 2);