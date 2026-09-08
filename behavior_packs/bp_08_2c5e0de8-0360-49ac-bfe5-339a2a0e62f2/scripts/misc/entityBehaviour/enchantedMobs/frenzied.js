import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "frenzied"

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            if (dim.isChunkLoaded(entity.location)) {
                const hp = entity.getComponent("health")
                if (hp.defaultValue / 2 >= hp.currentValue) {
                    entity.addEffect("strength", 5, { amplifier: 1 })
                    if (entity.hasTag("dungeons:enchanted_mob_quick")) {
                        entity.addEffect("speed", 5, { amplifier: 4 })

                    } else {
                        entity.addEffect("speed", 5, { amplifier: 1 })

                    }
                }

            }
        }
    }
})