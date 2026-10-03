import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "quick"

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                entity.addEffect("speed", 999999, { amplifier: 2, showParticles: false })
            }
        }
    }
})