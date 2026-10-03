import { system, world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:reeled_guardian") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(!player.hasTag("adv:dungeons:gone_fishin")) grantAdvancement(player, "dungeons:gone_fishin")
    }
})