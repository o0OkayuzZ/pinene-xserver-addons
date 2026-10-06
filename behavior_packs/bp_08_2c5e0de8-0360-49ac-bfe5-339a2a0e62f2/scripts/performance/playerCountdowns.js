import { system, world } from "@minecraft/server";

// These cooldowns used to have one runInterval callback each. They all performed
// the same per-tick operation over every online player, so process them in one
// pass without changing their tick duration or gameplay semantics.
const PLAYER_COUNTDOWN_OBJECTIVES = Object.freeze([
    "dungeons:glow_squid_armour_t",
    "dungeons:squid_armour_t",
    "dungeons:sweet_tooth_t",
    "dungeons:tp_robes_t",
    "dungeons:ember_robes_t",
    "dungeons:final_shout_t",
    "dungeons:shadow_blast_t",
    "dungeons:hunting_bow_t",
    "dungeons:poison_cloud_ranged_t",
    "dungeons:echo_t",
    "dungeons:gravity_t",
    "dungeons:poison_cloud_t",
    "dungeons:shockwave_t",
    "dungeons:stun_t",
    "dungeons:swirling_t",
    "dungeons:void_strike_t",
    "dungeons:battlestaff_sweep_t",
    "dungeons:rapier_sweep_t",
]);

system.runInterval(() => {
    const players = world.getPlayers();
    if (players.length === 0) return;

    const objectives = [];
    for (const id of PLAYER_COUNTDOWN_OBJECTIVES) {
        const objective = world.scoreboard.getObjective(id);
        if (objective) objectives.push(objective);
    }
    if (objectives.length === 0) return;

    for (const player of players) {
        const identity = player.scoreboardIdentity;
        if (!identity) continue;
        for (const objective of objectives) {
            if (!objective.hasParticipant(identity)) continue;
            const duration = objective.getScore(player);
            if (duration > 0) objective.addScore(player, -1);
            if (duration <= 0) objective.removeParticipant(player);
        }
    }
});
