import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";
system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ type: "minecraft:item" })) {
            const itemComp = entity.getComponent("item")
            if (!itemComp) continue;
            if (!dim.isChunkLoaded(entity.location)) continue;
            if (itemComp.itemStack.hasTag("dungeons:unique_item")) {
                dim.spawnParticle("dungeons:unique_item_glow", entity.location)

            } else if (itemComp.itemStack.hasTag("dungeons:seasonal_item")) {
                dim.spawnParticle("dungeons:seasonal_item_glow", entity.location)
            }
        }
    }
}, 20)