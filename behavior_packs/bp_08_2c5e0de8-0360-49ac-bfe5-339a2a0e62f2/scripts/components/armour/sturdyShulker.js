import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import { isValidTarget } from "main.js"


system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:sturdy_shulker_armour")) {
            const nearbyMobs = player.dimension.getEntities(
                {
                    location: player.location,
                    maxDistance: 8,
                    families: ['monster'],
                    excludeFamilies: ['ignore', "gravity_immune", "boss"]
                });
            if (nearbyMobs.length == 0) return;
            for (const mob of nearbyMobs) {
                if (isValidTarget(mob) == false) continue;
                if (mob.getEffect("levitation")) continue;
                const dim = mob.dimension
                const loc = player.location
                const targetLoc = mob.getHeadLocation()
                dim.spawnParticle("dungeons:shulker_stun", targetLoc)
                mob.addEffect("slowness", 30, { amplifier: 3, showParticles: false })
                mob.addEffect("levitation", 30, { amplifier: 3, showParticles: true })
                dim.playSound("mob.shulker.shoot", loc, { pitch: 1.25 })
                return;
            }
        }
    }
}, 80);