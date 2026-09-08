import {
    world,
    system
} from "@minecraft/server";

import { addVoidedEffect } from "misc/voidedEffect.js"

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:void_fluid", {
        onTick(e) {
            const { block, dimension } = e;
            if (dimension.isChunkLoaded(block.location) == false) return;
            const mobs = dimension.getEntitiesAtBlockLocation(block.location)
            for (const mob of mobs) {
                if (mob.typeId == "minecraft:item" || mob.typeId == "minecraft:xp_orb") continue;
                if (mob.matches({ excludeFamilies: ["ignore", "inanimate", "endersent", "enderling", "enderman", "endermite", "vengeful_heart_of_ender"] })) {
                    if (mob.typeIdd !== "minecraft:item" && mob.typeId !== "minecraft:xp_orb") addVoidedEffect(mob, 100)
                    mob.addEffect("slowness", 100, { amplifier: 0, showParticles: false })
                    if (mob.typeId == "minecraft:player") {
                        if (Math.floor(mob.getHeadLocation().y) == block.y) {
                            mob.addEffect("blindness", 10, { amplifier: 0, showParticles: false })
                        }
                    }
                }
            }
        }
    });
})
