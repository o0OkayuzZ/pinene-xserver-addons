import {
    world,
    system
} from "@minecraft/server";

const effectId = "dungeons:haunted_bow_fired_by"

const dimensionIds = ["overworld", "nether", "the_end"];
//Haunted BOW
system.runInterval(() => {
    for (let dimId of dimensionIds) {
        for (let entity of world.getDimension(dimId).getEntities({ tags: [effectId] })) {
            if (!entity.isOnGround && entity.dimension.isChunkLoaded(entity.location)) {
                entity.dimension.spawnParticle('dungeons:haunted_arrow', entity.location);
            }
        }
    }
})