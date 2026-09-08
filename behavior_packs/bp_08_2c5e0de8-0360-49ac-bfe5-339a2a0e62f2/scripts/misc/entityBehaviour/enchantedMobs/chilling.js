import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "chilling"

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const loc = entity.location
                const playersNearby = dim.getPlayers({ location: loc, maxDistance: 7.5, excludeGameModes: ["Spectator", "Creative"] })
                var effects = false
                for (const player of playersNearby) {
                    const slownessOnTarget = player.getEffect("slowness")
                    if (slownessOnTarget) {
                        if (slownessOnTarget.duration > 60) continue;
                    }
                    effects = true
                    player.addEffect("slowness", 55, { amplifier: 1 })
                    dim.spawnParticle("dungeons:satchel_elements_ice", player.getHeadLocation())
                    player.playSound("mob.player.hurt_freeze", { volume: 0.5 })
                }
                if (effects) {
                    dim.spawnParticle("dungeons:satchel_elements_use_ice", { x: loc.x, y: loc.y + 0.5, z: loc.z })
                }
            }
        }
    }
}, 40)