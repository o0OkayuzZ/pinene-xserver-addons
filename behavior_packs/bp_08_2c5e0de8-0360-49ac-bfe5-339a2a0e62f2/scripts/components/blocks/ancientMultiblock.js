import {
    world,
    system
} from "@minecraft/server";
system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:load_multiblock", {
        onTick(e, p) {
            const block = e.block;
            const dim = e.dimension;
            if (!dim.isChunkLoaded(block.location)) return;
            const targetId = p.params.id
            dim.runCommand("setblock " + `${block.x} ${block.y} ${block.z} ` + targetId)
        }
    });


    event.blockComponentRegistry.registerCustomComponent("dungeons:load_puzzle_piece", {
        onTick(e, p) {
            const block = e.block;
            const dim = e.dimension;
            if (!dim.isChunkLoaded(block.location)) return;
            const sec = p.params.section
            const active = p.params.active
            dim.runCommand("setblock " + `${block.x} ${block.y} ${block.z} ` + "dungeons:redstone_puzzle_piece " + `["dungeons:section"=${sec},"dungeons:active"=${active}]`)
        }
    });
})