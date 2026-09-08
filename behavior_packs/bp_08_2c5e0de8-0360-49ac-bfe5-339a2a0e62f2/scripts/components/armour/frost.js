import {
    world,
    system
} from "@minecraft/server";

import { isValidTarget } from "main.js"
import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:frost_armour") == false) continue;
        const dim = player.dimension;
        const loc = player.location;
        const mobs = dim.getEntities({ maxDistance: 8, location: loc, excludeFamilies: ["inanimate", "ignore"] })
        for (const target of mobs) {
            if (target == player) continue;
            if (isValidTarget(target) == false) continue;
            const slownessOnTarget = target.getEffect("slowness")
            if (slownessOnTarget) {
                if (slownessOnTarget.duration > 20) continue;
            }
            target.addEffect("slowness", 80, { amplifier: 1 })
            dim.spawnParticle("dungeons:satchel_elements_ice", target.getHeadLocation())
            if (target.typeId == "minecraft:player") target.playSound("mob.player.hurt_freeze", { volume: 0.5 })
        }
    }
}, 10)