import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:ocelot_armour")) {
            if (player.isSprinting) player.addEffect("speed", 4, { amplifier: 1, showParticles: false });
        }
    }
});