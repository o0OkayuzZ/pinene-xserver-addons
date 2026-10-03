import {
    world,
    system
} from "@minecraft/server";

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if (!dead || !dead.isValid) return
    if (dead.matches({ families: ["dungeons_spawner"] })) {
        system.runTimeout(() => {
            if (!dead.isValid) return;
            var xpAmt = 5 + Math.round(Math.random() * 10)
            if (dead.typeId == "dungeons:the_unending") xpAmt = 100
            for (let i = 0; i < xpAmt; i++) dead.dimension.spawnEntity("minecraft:xp_orb", dead.location)
            dead.dimension.spawnParticle("minecraft:ice_evaporation_emitter", dead.location)
            dead.dimension.spawnParticle("dungeons:tuff", dead.getHeadLocation())
            dead.remove()
        }, 1)
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const attacker = e.damageSource.damagingEntity;
    if (!attacker || !attacker.isValid) return
    if (attacker.matches({ families: ["dungeons_spawner"] }) && e.damageSource.cause == "entityAttack") e.cancel = true
})

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity || !entity.isValid) return
    if (entity.matches({ families: ["dungeons_spawner"] })) {
        const block = entity.dimension.getBlock(entity.location)
        entity.teleport(block.bottomCenter())
    }

})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    if (e.eventId !== "dungeons:spawn_mob") return;
    const entity = e.entity;
    if (!entity || !entity.isValid) return
    if (entity.matches({ families: ["dungeons_spawner"] })) {
        const loc = entity.location
        const dim = entity.dimension;
        const tag = "dungeons:spawned_by_" + `${entity.id}`
        if (dim.getEntities({ tags: [tag] }).length > 6) return;
        dim.playSound("mob.spawner.summon", loc)
        for (let i = 0; i < 2; i++) {
            if (dim.getEntities({ tags: [tag] }).length > 6) continue;
            const sloc = {
                x: loc.x + (Math.random() * 4 - Math.random() * 4),
                y: loc.y,
                z: loc.z + (Math.random() * 4 - Math.random() * 4)
            }
            const spawned = dim.spawnEntity(entity.getProperty("dungeons:spawn"), sloc, { spawnEvent: "dungeons:spawned_by_spawner" })
            if (!spawned.isValid) continue;
            spawned.addTag(tag)
            dim.spawnParticle("minecraft:ice_evaporation_emitter", sloc)
            dim.spawnParticle("dungeons:wildfire_flames", sloc)
        }
    }
})

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension)) dims.push(player.dimension)
    for (const dim of dims) {
        const spawners = dim.getEntities({ families: ["dungeons_spawner"] })
        for (const spawner of spawners) {
            if (!spawner.isValid) continue;
            const loc = spawner.location
            if (!dim.isChunkLoaded(loc)) continue;
            const block = dim.getBlock(loc)
            if (block.isAir == false && block.typeId !== "dungeons:corrupted_pumpkin_light") continue;
            block.setType("dungeons:corrupted_pumpkin_light")
        }
    }
})