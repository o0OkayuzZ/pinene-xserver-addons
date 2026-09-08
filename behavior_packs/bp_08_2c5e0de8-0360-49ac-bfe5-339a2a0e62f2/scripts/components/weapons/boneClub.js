import {
    system
} from "@minecraft/server";

import { getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:bone_club', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!attacker.isValid || !hit.isValid) return;



            const dir = getDirection(attacker.location, hit.location);
            hit.applyKnockback(makeVector(dir, 1.2), 0.23)
            const dim = hit.dimension;
            const targetLoc = hit.location;
            dim.playSound("weapon.bone_club.hit", targetLoc, { volume: 0.4, pitch: 1 })
            dim.playSound("weapon.bone_club.crush", targetLoc, { volume: 1.2, pitch: 0.8 })
        }
    });
});
