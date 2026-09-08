import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

//clones
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:spawn_illusioner_clones") {
        const loc = entity.location;
        const dim = entity.dimension;
        const loc1 = dim.getTopmostBlock({ x: loc.x + (3 + Math.random() * 3), z: loc.z }, loc.y).bottomCenter();
        const loc2 = dim.getTopmostBlock({ x: loc.x - (3 + Math.random() * 3), z: loc.z }, loc.y).bottomCenter();
        const loc3 = dim.getTopmostBlock({ x: loc.x, z: loc.z + (3 + Math.random() * 3) }, loc.y).bottomCenter();
        const loc4 = dim.getTopmostBlock({ x: loc.x, z: loc.z - (3 + Math.random() * 3) }, loc.y).bottomCenter();

        var locations = [loc1, loc2, loc3, loc4]

        const clonesNearby = dim.getEntities({ type: "dungeons:illusioner_clone", maxDistance: 32, location: loc })
        var i = clonesNearby.length;
        if (i == 4) {
            entity.remove()
            return;
        }
        dim.playSound("mob.illusioner.clone", loc)
        for (var location of locations) {
            if (i == 4) break;
            i += 1
            if (location.y - loc.y > 5 || location.y - loc.y < -5) location = entity.location;

            const clone = dim.spawnEntity('dungeons:illusioner_clone', { x: location.x, y: location.y + 1, z: location.z });
            dim.spawnParticle("dungeons:illusioner_spawn_clone", clone.location)
        }

        const illusioner = dim.getEntities({ type: "dungeons:illusioner", closest: 1, maxDistance: 32, location: loc })
        if (illusioner.length > 0) {
            const guy = illusioner[0]
            guy.addEffect("invisibility", 30)
        }
        entity.remove()
    }
});

//despawn_particle
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:despawn' && entity.typeId == "dungeons:illusioner_clone") {
        const loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:illusioner_despawn_clone", loc)
        dim.spawnParticle("dungeons:illusioner_despawn_clone", entity.getHeadLocation())
        entity.remove()
    }
});

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:remove_clones' && entity.typeId == "dungeons:illusioner") {
        const loc = entity.location;
        const dim = entity.dimension;
        const clonesNearby = dim.getEntities({ type: "dungeons:illusioner_clone", maxDistance: 32, location: loc })
        for (const clone of clonesNearby) {
            clone.triggerEvent("dungeons:despawn")
        }
    }
});