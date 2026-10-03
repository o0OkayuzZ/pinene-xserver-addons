import {
    system,
    world
} from "@minecraft/server";

function borderGenerating(dimensionId) {
    try {
        if (!dimensionId.includes("dungeons:ancientdim_")) return false;
        return world.getDynamicProperty("dungeons:generating_border_blocks") === true;
    } catch {
        return false;
    }
}

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:ender_vine", {
        onBreak(e) {
            if (borderGenerating(e.dimension.id)) return;
            const block = e.block
            if(e.dimension.isChunkLoaded(block.location) == false) return;
            const broken = e.brokenBlockPermutation.type.id
            const belowBlock = block.below()
            if(belowBlock.typeId == broken) {
                const belowPerm = belowBlock.permutation
                if (belowPerm.getState("dungeons:tip") !== true) {
                    belowBlock.setPermutation(belowPerm.withState("dungeons:tip", true))
                }
            }
        },
        onPlace(e) {
            if (borderGenerating(e.dimension.id)) return;
            const block = e.block
            if(e.dimension.isChunkLoaded(block.location) == false) return;
            const belowBlock = block.below()
            if(belowBlock.typeId == block.typeId) {
                const belowPerm = belowBlock.permutation
                if (belowPerm.getState("dungeons:tip") !== false) {
                    belowBlock.setPermutation(belowPerm.withState("dungeons:tip", false))
                }
            }
        }
    });
})