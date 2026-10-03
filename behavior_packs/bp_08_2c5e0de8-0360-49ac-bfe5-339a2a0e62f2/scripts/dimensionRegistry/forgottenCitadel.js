import { world, system, EntityDamageCause } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_forgotten_citadel"





system.runInterval(() => {
    for (const player of world.getDimension(DIM_ID).getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if (player.dimension.isChunkLoaded(player.location)) player.spawnParticle("dungeons:forgotten_citadel_ambient", player.location)
    }
}, 50)