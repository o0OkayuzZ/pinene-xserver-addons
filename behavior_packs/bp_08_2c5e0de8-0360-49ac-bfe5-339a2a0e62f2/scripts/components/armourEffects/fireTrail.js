import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import { isValidTarget, specialDamage } from "main.js"


system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (isWearingSet(player, "dungeons:fire_trail") && !player.isSprinting) {
            system.runTimeout(() => {
                if (player.isSprinting && player.isOnGround) {
                    if (player.isInWater) return;
                    var cd = world.scoreboard.getObjective('dungeons:fire_trail_t');
                    if (!cd) {
                        cd = world.scoreboard.addObjective('dungeons:fire_trail_t');
                    }
                    if (cd.hasParticipant(player.scoreboardIdentity)) {
                        return;
                    }
                    const dim = player.dimension
                    const loc = player.location;
                    cd.setScore(player, 100)
                    dim.playSound("armour.fire_trail", loc, { volume: 0.8 })
                }
            }, 1)
        }
    }
})

function createFire(player) {
    if (player.isInWater) return;
    const dim = player.dimension
    const loc = player.location
    dim.playSound("armour.fire_trail", loc, { volume: 0.1 })
    for (let i = 0; i < 8; i++) {
        system.runTimeout(() => {
            if (dim.isChunkLoaded(loc) == false) return;
            if (dim.getBlock(loc).typeId == "minecraft:water" || dim.getBlock(loc).isWaterLogged) return;
            dim.spawnParticle("dungeons:satchel_elements_fire", loc)
            for (let j = 0; j < 20; j++) {
                if (dim.isChunkLoaded(loc) == false) return;
                const damageRange = dim.getEntities({
                    location: loc,
                    maxDistance: 1,
                    excludeFamilies: ['ignore']
                });
                for (const target of damageRange) {
                    if (isValidTarget(target) == false) continue;
                    if (target === player) continue;
                    const setOnFire = target.setOnFire(1 + 2 * Math.random(), true)
                    if (setOnFire) {
                        specialDamage(player, target, 3, EntityDamageCause.fire, ["fire"])
                    }

                }
            }
        }, i * 5)
    }
}
// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:fire_trail_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        if (!isWearingSet(player, "dungeons:fire_trail") || !player.isSprinting) {
            timeLeft.removeParticipant(player)
            if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        }
        let duration = timeLeft.getScore(player);

        if (duration > 0) {
            timeLeft.addScore(player, -1);
            if (duration % 5 == 0) createFire(player)
        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
        }
    }
});