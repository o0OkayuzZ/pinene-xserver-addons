import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import { isValidTarget } from "main.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!isWearingSet(hurt, "dungeons:squid_armour")) return;
    var cd = world.scoreboard.getObjective('dungeons:squid_armour_t');
    if (!cd) {
        cd = world.scoreboard.addObjective('dungeons:squid_armour_t');
    }
    if (cd.hasParticipant(hurt.scoreboardIdentity)) {
        return;
    }
    const dim = hurt.dimension
    const loc = hurt.location;
    cd.setScore(hurt, 50)

    if (isWearingSet(hurt, 'dungeons:glow_squid_armour')) {
        dim.spawnParticle('dungeons:glow_squid_ink', loc);
        dim.playSound('mob.glow_squid.ink_squirt', loc, { volume: 0.6 });
    } else if (isWearingSet(hurt, 'dungeons:squid_armour')) {
        dim.spawnParticle('dungeons:squid_ink', loc);
        dim.playSound('mob._squid.ink_squirt', loc, { volume: 0.6 });
    } else {
        return;
    }

    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 4,
        excludeFamilies: ['ignore']
    });
    for (const target of damageRange) {
        if (isValidTarget(target) == false) continue;
        if (target === hurt) continue;
        if (target == attacker) {
            target.addEffect("weakness", 80)
            target.addEffect("blindness", 40)
        } else {
            target.addEffect("weakness", 60)
            target.addEffect("blindness", 20)

        }

    }

});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:squid_armour_t');
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