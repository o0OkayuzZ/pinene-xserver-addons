import {
    world,
    system
} from "@minecraft/server";

const effectId = "dungeons:haunted_bow_fired_by"

//Haunted BOW
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (let entity of dim.getEntities({ tags: [effectId] })) {
            if (!entity.isOnGround && dim.isChunkLoaded(entity.location)) {
                dim.spawnParticle('dungeons:haunted_arrow', entity.location);
            }
        }
    }
})