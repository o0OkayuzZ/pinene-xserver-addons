import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"
import { isValidTarget, specialDamage } from "main.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ tags: ["dungeons:exited_shadow_form"], excludeGameModes: ["Spectator"] })) {
        attemptBlast(player)

    }
    for (const player of world.getPlayers({ tags: ["dungeons:shadow_form_faded_out"], excludeGameModes: ["Spectator"] })) {
        attemptBlast(player)
        player.removeTag("dungeons:shadow_form_faded_out")

    }
});

function attemptBlast(player) {
    if (isWearingSet(player, "dungeons:shadow_blast")) {
        var cd = world.scoreboard.getObjective('dungeons:shadow_blast_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:shadow_blast_t');
        }
        if (cd.hasParticipant(player.scoreboardIdentity)) {
            return;
        }
        cd.setScore(player, 40)
        const dim = player.dimension
        var loc = player.location;
        loc = { x: loc.x, y: loc.y + 0.2, z: loc.z }
        dim.playSound("armour.shadow_blast", loc, { volume: 2 })
        dim.playSound("random.explode", loc, { pitch: 0.5 })
        dim.spawnParticle("dungeons:shadow_blast_1", loc)
        dim.spawnParticle("dungeons:shadow_blast_2", loc)
        dim.spawnParticle("dungeons:shadow_blast_3", loc)
        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 6,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === player) continue;
            specialDamage(player, target, 30, EntityDamageCause.entityExplosion, ["shadow"])


        }
    }
}

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:shadow_blast_t');
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