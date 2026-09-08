import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:cauldron_armour") == false) continue;
        player.dimension.spawnParticle('dungeons:cauldron_armour', player.location)
    }
}, 30)