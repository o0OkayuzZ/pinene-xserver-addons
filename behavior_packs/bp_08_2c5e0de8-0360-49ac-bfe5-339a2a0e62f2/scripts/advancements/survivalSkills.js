import { world, system } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"


world.afterEvents.playerDimensionChange.subscribe((e) => {
    const player = e.player;
    const toDim = e.toDimension;
    if(advancementsEnabled && toDim.id.includes("dungeons:ancientdim_corrupted_jungle")) {
        if (player.hasTag("adv:survival_skills")) return;
        player.addTag("adv:survival_skills_active")
    }
})

world.afterEvents.playerDimensionChange.subscribe((e) => {
    const player = e.player;
    const fromDim = e.fromDimension;
    if(advancementsEnabled && fromDim.id.includes("dungeons:ancientdim_corrupted_jungle")) {
        if (player.hasTag("adv:survival_skills")) return;
        system.runTimeout(() => {
            player.removeTag("adv:survival_skills_active")
        },2)
    }
})

system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:survival_skills_proven") {
        const player = e.sourceEntity;
        if(!player || !player.isValid) return;
        if(!advancementsEnabled) return;
        if(player.hasTag("adv:survival_skills_active") == false) return;
        if(!player.hasTag("adv:dungeons:survival_skills")) grantAdvancement(player, "dungeons:survival_skills")
    }
})