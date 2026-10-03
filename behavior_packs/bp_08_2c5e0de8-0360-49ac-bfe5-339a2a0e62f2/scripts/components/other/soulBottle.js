

import {
    world,
    system,
    ItemStack
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"
import {getSoulBarText} from "misc/soulManager.js"

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:soul_bottle', {
        onConsume(e) {
            const player = e.source;
            var max = 100
            if (isWearingSet(player, "dungeons:bag_o_souls")) max = 200
            player.dimension.playSound('ominous_bottle.end_use', player.location);
            let soulGauge = world.scoreboard.getObjective('soulGauge')
            if (soulGauge.getScore(player) >= max) return;
            if (soulGauge.getScore(player) + 100 >= max) {

                soulGauge.setScore(player, max)
            } else {
                soulGauge.addScore(player, 100)
            }
            if(soulGauge.getScore(player) >= max) player.runCommand("scriptevent dungeons:max_souls")
            player.onScreenDisplay.setActionBar(getSoulBarText(player))
            player.dimension.spawnParticle('dungeons:soul2', player.location);
            player.dimension.spawnParticle('dungeons:soul2', player.location);
            player.dimension.spawnParticle('dungeons:soul2', player.location);
            player.dimension.spawnParticle('dungeons:soul2', player.location);

        }
    })
})
