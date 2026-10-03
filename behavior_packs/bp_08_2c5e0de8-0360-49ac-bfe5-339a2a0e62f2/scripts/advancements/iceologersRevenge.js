import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {
    if(!advancementsEnabled) return;
    const mob = event.entity;
    const eventId = event.eventId;
    if (mob.typeId == "dungeons:ice_chunk_player" && eventId == "dungeons:hit") {
        const tameable = mob.getComponent("tameable")
        const owner = tameable.tamedToPlayer
        const isGlowSquidNear = mob.dimension.getEntities({ maxDistance: 3.7, location: mob.location, type: "minecraft:glow_squid" }).length > 0
        if (isGlowSquidNear && !owner.hasTag("adv:dungeons:iceologers_revenge")) grantAdvancement(owner, "dungeons:iceologers_revenge")
    }
})
