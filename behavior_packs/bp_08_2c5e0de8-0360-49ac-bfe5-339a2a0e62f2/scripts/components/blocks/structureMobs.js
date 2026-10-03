import { world, system } from "@minecraft/server";

const componentId = `dungeons:structure_mob`;

system.beforeEvents.startup.subscribe(initEvent => {
    initEvent.blockComponentRegistry.registerCustomComponent(componentId, {
        onTick(blockEvent, paramters) {
            const { block, dimension } = blockEvent;
            if (!dimension.isChunkLoaded(block.location)) {
                return;
            }
            const type = paramters.params.type;
            block.setType("air");
            if (!type) return;
            //world.sendMessage(`${type} ${group}`)
            dimension.spawnEntity(type, block.bottomCenter())
        }
    });
});