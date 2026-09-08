import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (player.isSprinting || isWearingSet(player, "dungeons:cloaked_skull") == false) continue;
        player.dimension.spawnParticle('dungeons:cloaked_skull_idle', player.location)
    }
}, 10)