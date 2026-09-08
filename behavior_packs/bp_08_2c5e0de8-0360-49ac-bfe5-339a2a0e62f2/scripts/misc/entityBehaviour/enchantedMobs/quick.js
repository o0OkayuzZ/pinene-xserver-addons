import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "quick"

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                entity.addEffect("speed", 999999, { amplifier: 2, showParticles: false })
            }
        }
    }
})