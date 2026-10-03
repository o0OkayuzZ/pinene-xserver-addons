import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

function heal(player, amt) {
    const hp = player.getComponent("health")
    if (!hp || hp.currentValue == hp.effectiveMax) return false;
    var setTo = hp.currentValue + amt
    if (setTo > hp.effectiveMax) setTo = hp.effectiveMax
    hp.setCurrentValue(setTo)
    return true
}

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:explorer")) {
            const loc = player.dimension.getBlock(player.location).center()
            system.runTimeout(() => {
                if (!isWearingSet(player, "dungeons:explorer")) return;
                const loc2 = player.dimension.getBlock(player.location).center()
                var distanceBetween = (Math.hypot(loc.x - loc2.x, loc.y - loc2.y, loc.z - loc2.z))
                if (distanceBetween < 10.2) return
                const healed = heal(player, 0.5)
                if (healed) {
                    player.dimension.spawnParticle("dungeons:explorer", player.location)
                }
            }, 40)
        }
    }
}, 80)