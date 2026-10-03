import {
    world,
    system
} from "@minecraft/server";
system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:light_block", {
        onTick(e) {
            const block = e.block;
            const dim = e.dimension;
            let entities = dim.getEntities({ location: block.location, maxDistance: 2 });
            if (dim.isChunkLoaded(block.location) == false) return;
            const perm = block.permutation;
            const light = perm.getState("dungeons:light")
            if (light > 1) {
                const newPerm = perm.withState("dungeons:light", light - 1);
                block.setPermutation(newPerm)
            } else {
                if (block.isWaterlogged) {
                    block.setType("minecraft:water")
                } else {
                    block.setType("minecraft:air")
                }
            }
        }
    });
})