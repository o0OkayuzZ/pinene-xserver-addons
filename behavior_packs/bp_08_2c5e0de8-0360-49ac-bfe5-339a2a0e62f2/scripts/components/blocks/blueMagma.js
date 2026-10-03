import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:blue_magma', {
        onTick(e) {
            const block = e.block;
            const dim = e.dimension
            if (!dim.isChunkLoaded(block.location)) return;
            if (block.above().typeId !== "minecraft:water") return;
            const max = dim.heightRange.max
            for (let i = block.y + 1; i < max + 1; i++) {
                const checkBlock = dim.getBlock({
                    x: block.x,
                    y: i,
                    z: block.z
                })
                if (checkBlock.typeId !== "minecraft:water") {
                    i = 1000
                    continue;
                }
                if (Math.random() > 0.9) dim.spawnParticle("minecraft:bubble_column_down_particle", checkBlock.center())
                const entities = dim.getEntitiesAtBlockLocation(checkBlock.location)
                for (const target of entities) {
                    if (target.isValid && target.isInWater) target.addEffect("water_breathing", 400, {showParticles:false})
                }
            }
        }
    })
})



