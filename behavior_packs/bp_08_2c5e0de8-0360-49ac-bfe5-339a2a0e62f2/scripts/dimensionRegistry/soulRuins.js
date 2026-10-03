import { world, system } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_soul_ruins"





system.runInterval(() => {
    if(!hunts) return; 
    const dim = world.getDimension(DIM_ID)
    for (const player of dim.getPlayers()) {
        if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
        if(Math.random() < 0.99) continue;
        if (dim.isChunkLoaded(player.location)) {
            const randX = Math.random() * 11 - 5.5
            const randZ = Math.random() * 11 - 5.5
            var loc = {
                x:player.location.x + randX,
                y:player.location.y,
                z:player.location.z + randZ
            }
            const topMost = dim.getTopmostBlock({x:loc.x,z:loc.z}, loc.y)
            if(topMost) {
                loc = {
                    x:loc.x, 
                    y:topMost.bottomCenter().y,
                    z:loc.z
                }
            } else {
                loc = {
                    x:loc.x, 
                    y:loc.y-1,
                    z:loc.z
                }
            }
            if (dim.isChunkLoaded(loc)) {
                player.spawnParticle("dungeons:soul2", loc)
            }

        }
    }
}, 1)