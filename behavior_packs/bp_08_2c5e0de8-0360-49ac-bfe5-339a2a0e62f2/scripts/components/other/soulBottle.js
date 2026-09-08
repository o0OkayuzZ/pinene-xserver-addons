

import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:soul_bottle', {
        onConsume(e) {
            const player = e.source;

            player.dimension.playSound('ominous_bottle.end_use', player.location);
            let soulGauge = world.scoreboard.getObjective('soulGauge')
            if (soulGauge.getScore(player) >= 100) return;
            soulGauge.setScore(player, 100)
            player.onScreenDisplay.setActionBar(`§b${soulGauge.getScore(player)}§s ソウル `)
            player.dimension.spawnParticle('dungeons:soul2', player.location);
            player.dimension.spawnParticle('dungeons:soul2', player.location);
            player.dimension.spawnParticle('dungeons:soul2', player.location);
            player.dimension.spawnParticle('dungeons:soul2', player.location);

        }
    })
})
