import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "electrified"

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const loc = entity.location
                const playersNearby = dim.getPlayers({ location: loc, maxDistance: 5.5, excludeGameModes: ["Spectator", "Creative"] })
                var effects = false
                for (const player of playersNearby) {
                    var damage = player.applyDamage(9, { cause: "lightning", damagingEntity: entity })
                    if (effects == false) effects = damage
                    dim.spawnParticle("dungeons:lightning_wand_shock", player.location)
                }
                if (effects) {
                    dim.playSound("weapon.enchant.thundering", loc)
                    dim.spawnParticle("dungeons:satchel_elements_use_electric", { x: loc.x, y: loc.y + 0.5, z: loc.z })
                }
            }
        }
    }
}, 100)