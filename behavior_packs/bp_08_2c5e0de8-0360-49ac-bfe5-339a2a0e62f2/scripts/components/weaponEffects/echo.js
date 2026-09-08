import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage } from "main.js";

const effectId = "dungeons:echo"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && heldItem.getDynamicProperty("dungeons:gild") !== effectId) return;
    //effect code
    if (e.damage <= 0) return;
    const hp = hurt.getComponent("health")
    if (hp) {
        if (hp.currentValue <= 0) return;
    }
    system.run(() => {
        var echoT = world.scoreboard.getObjective('dungeons:echo_t');
        if (!echoT) {
            echoT = world.scoreboard.addObjective('dungeons:echo_t');
        }
        if (echoT.hasParticipant(attacker.scoreboardIdentity)) return;
        echoT.setScore(attacker, 110);
        system.runTimeout(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            dim.spawnParticle('dungeons:echo', hurtLoc);
            dim.playSound('weapon.daggers.hit', hurtLoc, {
                volume: 0.6
            });
            const diddamage = specialDamage(attacker, hurt, 7, cause, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
            if (diddamage == false) specialDamage(attacker, hurt, 1, cause, ["weapon"])
        }, 10)
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:echo_t');
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