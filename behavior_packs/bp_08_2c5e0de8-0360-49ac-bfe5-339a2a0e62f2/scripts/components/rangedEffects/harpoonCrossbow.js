import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:harpoon_crossbow_bow_effect"

const dimIds = ["overworld", "nether", "the_end"]

system.runInterval(() => {
    for (let dimId of dimIds) {
        for (let entity of world.getDimension(dimId).getEntities({
            tags: [effectId]
        })) {
            if (entity.typeId == "dungeons:harpoon_arrow") continue;
            const proj = entity.getComponent("projectile")
            proj.liquidInertia = proj.airInertia
        }
    }
})
