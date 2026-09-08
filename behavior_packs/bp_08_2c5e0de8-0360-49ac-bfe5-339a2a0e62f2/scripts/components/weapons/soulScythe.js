import {
    system
} from "@minecraft/server";

import { getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:scythe', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!attacker.isValid || !hit.isValid) return;



            const dir = getDirection(attacker.location, hit.location);
            hit.applyKnockback(makeVector(dir, 0.1), 0.1)
            const dim = hit.dimension;
            const targetLoc = hit.location;
            if (e.itemStack.typeId == "dungeons:skull_scythe") {
                dim.playSound("weapon.soul_scythe.hit.spooky", targetLoc, { volume: 1, pitch: 1 })
            } else {
                dim.playSound("weapon.soul_scythe.hit", targetLoc, { volume: 1, pitch: 1 })
            }
        }
    });
});
