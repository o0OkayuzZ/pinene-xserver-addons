import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if(!dead) return;
    if(dead.typeId !== "dungeons:piggy_bank") return;
    const attacker = e.damageSource.damagingEntity;
    if(!attacker || !attacker.isValid || attacker.typeId !== "minecraft:player") return;
    if(!advancementsEnabled) return;
    if(attacker.hasTag("adv:dungeons:thats_all_folks") == false) grantAdvancement(attacker, "dungeons:thats_all_folks")

})