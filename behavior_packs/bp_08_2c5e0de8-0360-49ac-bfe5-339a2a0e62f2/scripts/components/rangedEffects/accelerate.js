import {
    world,
    system
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
const effectId = "dungeons:accelerate_bow_effect"


world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!arrowTypes.includes(entity.typeId)) return;
    system.runTimeout(() => {
        if (!entity || !entity.isValid) return;
        if (entity.hasTag(effectId)) {
            const v = entity.getVelocity()
            entity.applyImpulse({
                x: v.x * 1.5,
                y: v.y,
                z: v.z * 1.5
            })
        }
    }, 1)
})