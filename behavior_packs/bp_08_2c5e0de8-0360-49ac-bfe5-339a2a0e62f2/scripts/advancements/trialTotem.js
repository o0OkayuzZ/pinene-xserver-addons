import { system, world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:cleared_trial_totem") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(!player.hasTag("adv:dungeons:its_an_ambush")) grantAdvancement(player, "dungeons:its_an_ambush")
    }
    if(e.id == "dungeons:cleared_ominous_trial_totem") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(!player.hasTag("adv:dungeons:ominous_encounter")) grantAdvancement(player, "dungeons:ominous_encounter")
    }
})