import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:hungry_horror_armour")) {
            if(Math.random() > 0.4) continue;
            player.dimension.spawnParticle('dungeons:hungry_horror_ambient_particle', player.location)
        } else if (isWearingSet(player, "dungeons:hungriest_horror_armour")) {
            if(Math.random() > 0.4) continue;
            player.dimension.spawnParticle('dungeons:hungriest_horror_ambient_particle', player.location)
        }
    }
}, 10)