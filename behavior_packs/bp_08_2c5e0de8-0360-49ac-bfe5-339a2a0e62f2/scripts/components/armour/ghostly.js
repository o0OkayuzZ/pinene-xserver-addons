import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

// Ghost Armour
system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (player.isSprinting && isWearingSet(player, "dungeons:ghostly_armour")) {
            player.addEffect("speed", 4, { amplifier: 0, showParticles: false });
            player.addEffect("invisibility", 4, { amplifier: 0, showParticles: false });
            player.addEffect("weakness", 4, { amplifier: 0, showParticles: false });
            player.playAnimation('animation.shadow', { nextState: 'shadowForm' });
            var particleName = "dungeons:ghostly_smoke"
            if (isWearingSet(player, "dungeons:ghost_kindler")) particleName = "dungeons:ghostly_smoke_red"
            if (isWearingSet(player, "dungeons:cloaked_skull")) particleName = "dungeons:ghostly_smoke_black"
            player.dimension.spawnParticle(particleName, player.location)
        }
    }
});