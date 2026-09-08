import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
// Opulent Armour
system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:opulent_armour")) {
            const xp = player.getTotalXp();
            system.runTimeout(() => {
                if (player.getTotalXp() > xp) {
                    var cd = world.scoreboard.getObjective('dungeons:opulent_armour_t');
                    if (!cd) {
                        cd = world.scoreboard.addObjective('dungeons:opulent_armour_t');
                    }
                    if (cd.hasParticipant(player.scoreboardIdentity)) {
                        return;
                    }
                    const dim = player.dimension
                    const loc = player.location;
                    cd.setScore(player, 100)
                    dim.playSound('beacon.activate', loc, { pitch: 1.5, volume: 0.3 });

                }
            }, 1);
        }
    }
}, 1);

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:opulent_armour_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 50) player.dimension.spawnParticle("dungeons:opulent_immunity", player.location)
        if (duration > 0) {
            timeLeft.addScore(player, -1);

        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
        }
    }
});

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    var timeLeft = world.scoreboard.getObjective('dungeons:opulent_armour_t');
    if (!timeLeft) return;
    if (!hurt.scoreboardIdentity) return;
    if (!timeLeft.hasParticipant(hurt.scoreboardIdentity)) return;
    let duration = timeLeft.getScore(hurt);
    if (duration <= 50) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = 0 * e.damage
    e.cancel = true;
});