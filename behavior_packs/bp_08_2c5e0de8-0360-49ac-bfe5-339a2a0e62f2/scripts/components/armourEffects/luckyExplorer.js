import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:lucky_explorer")) {
            const loc = player.dimension.getBlock(player.location).center()
            system.runTimeout(() => {
                if (!isWearingSet(player, "dungeons:lucky_explorer")) return;
                const loc2 = player.dimension.getBlock(player.location).center()
                var distanceBetween = (Math.hypot(loc.x - loc2.x, loc.y - loc2.y, loc.z - loc2.z))
                if (distanceBetween < 10.2) return
                for (let i = 0; i < Math.ceil(player.level / 10) && i < 50; i++) {
                    system.runTimeout(() => {
                        player.addExperience(1)
                    }, i)
                }
            }, 40)
        }
    }
}, 80)