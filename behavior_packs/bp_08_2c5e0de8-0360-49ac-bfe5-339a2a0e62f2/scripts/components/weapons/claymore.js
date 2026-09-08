import {
    system
} from "@minecraft/server";

import { getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:claymore', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!attacker.isValid || !hit.isValid) return;



            const dir = getDirection(attacker.location, hit.location);
            hit.applyKnockback(makeVector(dir, 1.2), 0.23)
        }
    });
});
