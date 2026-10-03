import { system, world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:death_barter_triggered") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(!player.hasTag("dungeons:never_back_down")) grantAdvancement(player, "dungeons:never_back_down")
    }
})