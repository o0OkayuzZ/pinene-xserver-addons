import {
    world,
    system
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"


world.afterEvents.entityHealthChanged.subscribe((e) => {
    const player = e.entity;
    const diff = e.newValue - e.oldValue;
    if (diff <= 1.5) return;
    if (player.typeId !== 'minecraft:player') {
        return;
    }
    if (isWearingSet(player, "dungeons:potion_barrier")) {
        var cd = world.scoreboard.getObjective('dungeons:potion_barrier_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:potion_barrier_t');
        }
        if (cd.hasParticipant(player.scoreboardIdentity)) {
            return;
        }
        const dim = player.dimension
        cd.setScore(player, 100)
        dim.playSound('weapon.enchant.guarding_strike', player.location, { pitch: 1.5 })
    }
})

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:potion_barrier_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) player.dimension.spawnParticle("dungeons:potion_barrier", player.location)
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
    var timeLeft = world.scoreboard.getObjective('dungeons:potion_barrier_t');
    if (!timeLeft) return;
    if (!hurt.scoreboardIdentity) return;
    if (!timeLeft.hasParticipant(hurt.scoreboardIdentity)) return;
    let duration = timeLeft.getScore(hurt);
    if (duration <= 0) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    if (e.damageSource.cause == "selfDestruct") return;
    e.damage = e.damage * 0.25
    if (hurt.getDynamicProperty("dungeons:damage_reduction_prevented") >= baseDmg) {
        e.cancel = true;
        return;
    }
    hurt.setDynamicProperty("dungeons:damage_reduction_prevented", baseDmg)
    system.runTimeout(() => {
        hurt.setDynamicProperty("dungeons:damage_reduction_prevented", null)
    }, 9)
});
