import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ type: "minecraft:item" })) {
            const itemComp = entity.getComponent("item")
            if (!itemComp) continue;
            if (!dim.isChunkLoaded(entity.location)) continue;
            var isGild = false
            for (const propertyId of itemComp.itemStack.getDynamicPropertyIds()) {
                if (propertyId.includes("dungeons:gild_")) isGild = true
            }
            if (isGild) {
                dim.spawnParticle("dungeons:gilded_sparkle", entity.location)
            }
            if (itemComp.itemStack.hasTag("dungeons:unique_item")) {
                dim.spawnParticle("dungeons:unique_item_glow", entity.location)

            } else if (itemComp.itemStack.hasTag("dungeons:seasonal_item")) {
                dim.spawnParticle("dungeons:seasonal_item_glow", entity.location)
            }
            if (isGild && !itemComp.itemStack.hasTag("dungeons:unique_item")) {
                dim.spawnParticle("dungeons:unique_item_glow", entity.location)
                dim.spawnParticle("dungeons:unique_item_glow", entity.location)

            }
        }
    }
}, 20)