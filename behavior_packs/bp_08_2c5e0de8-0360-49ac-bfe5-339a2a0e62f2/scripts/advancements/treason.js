import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return
    const entity = e.entity;
    if (entity.typeId == "dungeons:arch_illager_death_animation") {
        for (const player of entity.dimension.getPlayers({ maxDistance: 32, location: entity.location, excludeTags: ["adv:dungeons:treason"], excludeGameModes: ["Spectator"] })) {
            grantAdvancement(player, "dungeons:treason")
        }
    }
})