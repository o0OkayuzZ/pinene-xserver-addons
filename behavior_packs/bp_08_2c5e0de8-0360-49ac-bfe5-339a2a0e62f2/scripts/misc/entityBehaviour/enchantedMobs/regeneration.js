import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "regeneration"

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const onfire = entity.getComponent("onfire")
                if (onfire) return;
                const hp = entity.getComponent("health")
                if (hp.currentValue + 1 <= hp.defaultValue) {
                    hp.setCurrentValue(hp.currentValue + 1)
                } else {
                    hp.setCurrentValue(hp.defaultValue)
                }
            }
        }
    }
}, 6)