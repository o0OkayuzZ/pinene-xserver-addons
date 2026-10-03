import { system, world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:windcallers_blown") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(!player.hasTag("adv:dungeons:taste_of_your_own_medicine")) grantAdvancement(player, "dungeons:taste_of_your_own_medicine")
    }
})