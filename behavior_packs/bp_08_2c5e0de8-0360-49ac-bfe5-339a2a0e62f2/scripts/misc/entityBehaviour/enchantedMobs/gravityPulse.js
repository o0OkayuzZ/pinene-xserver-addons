import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "gravity_pulse"
import { isValidTarget, gravityTo } from "main.js"

function gravityPulse(targetLoc, dim, owner) {
    const gravityTargets = dim.getEntities({
        location: targetLoc,
        maxDistance: 6,
        minDistance: 0.5,
        excludeFamilies: ['ignore', 'gravity_immune']
    });
    system.run(() => {
        if (dim.isChunkLoaded(targetLoc)) {
            dim.spawnParticle("dungeons:ranged_gravity", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
            dim.playSound("mob.endermen.portal", targetLoc, { pitch: 0.65 })
        }
        for (const target of gravityTargets) {
            if (target.typeId == "minecraft:player") gravityTo(target, targetLoc)
        }
    })
}

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const playersNearby = dim.getPlayers({ location: entity.location, maxDistance: 20 })
                if (playersNearby.length == 0) continue;
                gravityPulse(entity.location, dim, entity)
            }
        }
    }
}, 100)