import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "fire_trail"

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const loc = entity.location
                const playersNearby = dim.getPlayers({ location: loc, maxDistance: 32 })
                const isFire = dim.getEntities({ location: loc, type: "dungeons:enchanted_fire", maxDistance: 0.66 })
                if (entity.isOnGround == false) continue;
                if (isFire.length <= 0 && playersNearby.length > 0 && !entity.isInWater) dim.spawnEntity("dungeons:enchanted_fire", loc)
            }
        }
    }
}, 3)

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:wraith_fire_hit' && entity.typeId == "dungeons:enchanted_fire") {
        if (!entity.isValid) return;
        const dim = entity.dimension;
        var loc = entity.location;
        loc = { x: loc.x, y: loc.y + 0.1, z: loc.z }
        if (Math.random() > 0.25) dim.spawnParticle("dungeons:wretched_wraith_fire_smoke", loc)
        const damageRange = dim.getEntitiesAtBlockLocation(loc)
        if (damageRange.length < 1) return;
        var targets = []

        var damage = 4
        if (world.getDifficulty() == "Hard") damage += 2
        if (world.getDifficulty() == "Easy") damage -= 2
        for (const damaged of damageRange) {
            if (targets.includes(damaged)) continue;
            if (damaged.matches({ families: ["monster"] })) continue;
            if (damaged.matches({ families: ["undead"] })) continue;
            if (damaged.getEffect("fire_resistance")) continue;
            if (damaged.typeId == "minecraft:player") {
                if (damaged.getGameMode() == "Creative") continue;
            }
            if (damaged.typeId == "minecraft:player" || damaged.matches({ families: ["player"] }) || damaged.matches({ families: ["mob"] }) || damaged.matches({ families: ["animal"] })) targets.push(damaged)
        }
        if (targets.length < 1) return;
        for (const target of targets) {
            const didDamage = target.applyDamage(damage, { cause: "fire" })
            if (didDamage) {
                target.setOnFire(2)
            }
        }
    }
})

//spawn fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId == "dungeons:enchanted_fire" && id == "minecraft:entity_spawned") {
        const dim = entity.dimension;
        const loc = entity.location;
        const block = dim.getTopmostBlock({ x: loc.x, z: loc.z }, loc.y + 4).above()
        const tpLoc = { x: block.bottomCenter().x, y: block.bottomCenter().y - 0.1, z: block.bottomCenter().z }
        entity.addEffect("invisibility", 3, { showParticles: false })
        if (block.below().isAir == false) {
            const isFire = dim.getEntities({ location: tpLoc, families: ["dungeons_fire"], maxDistance: 0.1 })
            if (isFire.length >= 1) {
                entity.remove()
            } else {
                entity.tryTeleport(tpLoc)
            }
        }
        if (!entity.isValid) return;
        entity.setDynamicProperty("dungeons:fire_type", "enchanted_fire")
        dim.playSound("mob.wraith.fire", tpLoc, { pitch: 0.55, volume: 0.2 })
    }
})