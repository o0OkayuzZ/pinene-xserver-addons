import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (isWearingSet(hurt, "dungeons:glow_squid_armour") == false) return;
    var cd = world.scoreboard.getObjective('dungeons:glow_squid_armour_t');
    if (!cd) {
        cd = world.scoreboard.addObjective('dungeons:glow_squid_armour_t');
    }
    if (cd.hasParticipant(hurt.scoreboardIdentity)) {
        return;
    }
    const dim = hurt.dimension
    const loc = hurt.location;
    cd.setScore(hurt, 16)
    dim.spawnParticle('dungeons:glow_squid_sparkles', loc);
    dim.playSound('mob.glow_squid.ink_squirt', loc, { pitch: 1.5, volume: 0.6 });
})

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:glow_squid_armour_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

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
    var timeLeft = world.scoreboard.getObjective('dungeons:glow_squid_armour_t');
    if (!timeLeft) return;
    if (!hurt.scoreboardIdentity) return;
    if (!timeLeft.hasParticipant(hurt.scoreboardIdentity)) return;
    if (e.damageSource.cause == "selfDestruct") return;
    if (e.damageSource.cause == "override") return;
    e.damage = 0 * e.damage
    e.cancel = true;
});