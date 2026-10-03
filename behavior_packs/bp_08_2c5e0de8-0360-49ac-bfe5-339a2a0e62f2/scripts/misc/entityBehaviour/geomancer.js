import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, getDirection, makeVector } from "main.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (entity.typeId !== "dungeons:stone_pillar") return;
    entity.playAnimation("animation.stone_pillar.shake")
    const dim = entity.dimension;
    const loc = dim.getBlock(entity.location).bottomCenter()
    for (const mob of dim.getEntitiesAtBlockLocation(loc)) {
        if (mob.typeId == entity.typeId && mob !== entity) return entity.remove()
    }
    if (!entity.isValid) return;
    entity.teleport({ x: loc.x, y: loc.y - 3.14, z: loc.z })
    system.runTimeout(() => {
        entity.setProperty("dungeons:start", true)
        if (entity.getProperty("dungeons:explosive") == true) {
            dim.playSound("mob.geomancer.bomb_rise", loc, { pitch: Math.random() / 5 + 0.9 })

        } else {
            dim.playSound("mob.geomancer.pillar_rise", loc, { pitch: Math.random() / 5 + 0.9 })
        }
    }, 1)
    for (let i = 0; i < 20; i++) {
        system.runTimeout(() => {
            const tLoc = entity.location
            entity.teleport({ x: tLoc.x, y: tLoc.y + 3.13 / 20, z: tLoc.z })
            if (entity.isOnGround == false) entity.teleport(tLoc)
        }, i)
    }
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    if (e.eventId !== "dungeons:sink_into_ground") return;
    const entity = e.entity
    if (entity.typeId !== "dungeons:stone_pillar") return;
    entity.dimension.playSound("mob.geomancer.bomb_sink", entity.location, { pitch: Math.random() / 5 + 0.4 })
    for (let i = 0; i < 10; i++) {
        system.runTimeout(() => {
            const tLoc = entity.location
            entity.teleport({ x: tLoc.x, y: tLoc.y - 3.13 / 10, z: tLoc.z })
        }, i)
    }
    system.runTimeout(() => {
        entity.remove()
    }, 10)
})

world.beforeEvents.explosion.subscribe((e) => {
    const entity = e.source;
    if (!entity || !entity.isValid) return;
    if (entity.typeId !== "dungeons:stone_pillar") return;
    const loc = entity.location;
    const dim = e.dimension;
    e.cancel = true;
    system.run(() => {

        const nearbyGeomancer = dim.getEntities({ location: loc, maxDistance: 32, families: ["geomancer"], closest: 1 })
        var geomancer = undefined
        if (nearbyGeomancer.length > 0) geomancer = nearbyGeomancer[0]

        dim.spawnParticle("dungeons:geomancer_pillar_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
        dim.spawnParticle("dungeons:geomancer_pillar_boom_dust", loc)
        dim.playSound("random.explode", loc, { pitch: 0.8 })

        const targets = dim.getEntities({ location: loc, maxDistance: 6, excludeFamilies: ["illager"], excludeTags: ["dungeons:ancient_hunt"] })
        for (const target of targets) {
            if ((isValidTarget(target) || target.matches({ families: ["player"] }))) {
                var damage = false
                if (geomancer) damage = target.applyDamage(15, { cause: EntityDamageCause.entityExplosion, damagingEntity: geomancer })
                if (!geomancer) damage = target.applyDamage(15, { cause: EntityDamageCause.entityExplosion })
                if (damage) {
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 0.6), 0.4)
                }
                if (target.typeId == "minecraft:player") {
                    target.runCommand("camerashake add @s 0.15 2")
                    target.runCommand("camerashake add @s 0.15 1.5")
                    target.runCommand("camerashake add @s 0.15 1")
                    target.runCommand("camerashake add @s 0.15 0.5")
                }
            }
        }
    })
})