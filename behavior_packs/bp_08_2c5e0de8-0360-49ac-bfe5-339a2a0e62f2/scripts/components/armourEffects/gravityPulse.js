import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import { isValidTarget, gravityTo } from "main.js"

function gravityPulse(targetLoc, dim, owner) {
    const gravityTargets = dim.getEntities({
        location: targetLoc,
        maxDistance: 6,
        minDistance: 0.5,
        excludeFamilies: ['ignore', 'gravity_immune']
    });
    system.run(() => {
        var particle = false
        for (const target of gravityTargets) {
            if (target == owner || isValidTarget(target) == false) continue;
            gravityTo(target, targetLoc)
            particle = true
        }
        if (particle) {
            if (dim.isChunkLoaded(targetLoc)) {
                dim.spawnParticle("dungeons:ranged_gravity", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
                dim.playSound("mob.endermen.portal", targetLoc, { pitch: 0.65 })
            }
        }
    })
}

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (!isWearingSet(player, "dungeons:gravity_pulse")) continue;
        var cd = world.scoreboard.getObjective('dungeons:gravity_pulse_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:gravity_pulse_t');
        }
        if (!cd.hasParticipant(player.scoreboardIdentity)) {
            cd.setScore(player, 60)
        }
        const score = cd.getScore(player)
        if (score > 0) {
            cd.addScore(player, -1)
        } else {
            cd.setScore(player, 60)
            if (!player.isSneaking) gravityPulse(player.location, player.dimension, player)
        }
    }
});