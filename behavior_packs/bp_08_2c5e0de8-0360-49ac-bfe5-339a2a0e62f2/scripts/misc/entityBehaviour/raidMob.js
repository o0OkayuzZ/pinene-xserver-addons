import {
    world,
    system
} from "@minecraft/server";

//vfx
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:spawn_for_raid') {
        const dim = entity.dimension;
        const loc = entity.location;
        if (dim.isChunkLoaded(loc) == false) return;
        dim.spawnParticle('dungeons:instant_teleport', entity.getHeadLocation())
        dim.playSound("mob.endermen.portal", loc, { pitch: 0.65 })
        if (entity.hasTag("dungeons:existed_already")) dim.playSound("armor.equip_iron", loc, { volume: 2, pitch: 0.65 })
    }
})
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity || !entity.isValid) return;
    if (entity.matches({ families: ["illager"] })) {
        system.runTimeout(() => {
            entity.addTag("dungeons:existed_already")
        }, 3)
    }
})