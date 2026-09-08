import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { getDamageColour } from "misc/debug.js"
world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "dungeons:target_dummy") return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== "minecraft:player") {
        const tameable = attacker.getComponent("tameable")
        if (!tameable) return;
        if (!tameable.tamedToPlayer) return;
    }
    const damage = Math.round(e.damage * 100) / 100;
    hurt.addEffect("regeneration", 10, { amplifier: 5, showParticles: false })
    hurt.nameTag = `§l${getDamageColour(damage)}${damage}`
    system.runTimeout(() => {
        if (hurt.isValid == false) return;
        if (hurt.nameTag = `§l${getDamageColour(damage)}${damage}`) hurt.nameTag = `${getDamageColour(damage)}${damage}`
    }, 5)
    system.runTimeout(() => {
        if (hurt.isValid == false) return;
        if (hurt.nameTag = `${getDamageColour(damage)}${damage}`) hurt.nameTag = ""
    }, 30)
})