import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

function snowField(loc, dim, radius) {
    for (let i = 0; i < 40; i++) {
        system.runTimeout(() => {
            const mobsinrange = dim.getEntities({ maxDistance: radius, location: loc, excludeFamilies: ["creeper"], excludeGameModes: ["Spectator"] })
            for (const target of mobsinrange) {
                target.addEffect("slowness", 55, { amplifier: 1 })
            }
            dim.spawnParticle("dungeons:ice_creeper_snow_aura", loc)
        }, i * 5)
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:ice_boom' && (entity.typeId == "dungeons:icy_creeper" || entity.typeId == "dungeons:enchanted_icy_creeper")) {
        const loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:frost_boom", loc)
        snowField(loc, dim, 5)
    } else if (id === 'dungeons:ice_boom_charged' && (entity.typeId == "dungeons:icy_creeper" || entity.typeId == "dungeons:enchanted_icy_creeper")) {
        const loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:charged_frost_boom", loc)
        snowField(loc, dim, 7)
    }
});