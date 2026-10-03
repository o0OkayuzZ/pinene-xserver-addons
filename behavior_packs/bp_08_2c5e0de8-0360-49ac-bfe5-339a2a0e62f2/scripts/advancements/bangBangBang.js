import { system, world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:salvaged_item") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(!player.hasTag("adv:dungeons:bang_bang_bang")) grantAdvancement(player, "dungeons:bang_bang_bang")
    }
})