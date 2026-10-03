import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import {getSoulBarText} from "misc/soulManager.js"

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const wearing = isWearingSet(player, "dungeons:bag_o_souls")
        if (!wearing) continue;
        system.runTimeout(() => {
            if (!isWearingSet(player, "dungeons:bag_o_souls")) {
                var lock = false
                for (let i = 0; i < 100; i++) {
                    system.runInterval(() => {
                        if (lock == true) return;
                        if (world.scoreboard.getObjective('soulGauge').getScore(player) <= 100) {
                            player.onScreenDisplay.setActionBar(getSoulBarText(player, false))
                            lock = true
                            return;
                        } else {
                            world.scoreboard.getObjective("soulGauge").addScore(player, -1)
                            player.onScreenDisplay.setActionBar(getSoulBarText(player, true))
                        }
                    }, i)
                }
            }
        }, 1)
    }
});