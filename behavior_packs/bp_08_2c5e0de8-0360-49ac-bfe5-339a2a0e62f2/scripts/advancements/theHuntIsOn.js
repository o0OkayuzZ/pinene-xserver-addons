import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.playerDimensionChange.subscribe((e) => {
    const player = e.player;
    const toDim = e.toDimension;
    if(advancementsEnabled && toDim.id.includes("dungeons:ancientdim_")) {
        if (player.hasTag("adv:dungeons:the_hunt_is_on")) return;
        grantAdvancement(player, "dungeons:the_hunt_is_on")
    }
})