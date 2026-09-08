import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:spooky_gourdian") == false) continue;
        player.dimension.spawnParticle('dungeons:spooky_gourdian_idle', player.location)
    }
}, 10)