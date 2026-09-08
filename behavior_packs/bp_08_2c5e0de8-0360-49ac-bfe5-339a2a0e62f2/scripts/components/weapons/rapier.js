import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:rapier', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;

            var cooldown = world.scoreboard.getObjective('dungeons:rapier_sweep_t');
            if (!cooldown) {
                cooldown = world.scoreboard.addObjective('dungeons:rapier_sweep_t');
            }
            if (cooldown.hasParticipant(attacker.scoreboardIdentity)) {
                cooldown.setScore(attacker, 20);
                return;
            };
            cooldown.setScore(attacker, 15);

            var damage = 3
            if (unique == true) damage = 5
            const dim = attacker.dimension;
            const targetLoc = hit.location
            const damageRange = dim.getEntities({
                location: targetLoc,
                maxDistance: 2.5,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                if (isValidTarget(target) == false) continue;
                if (target === hit) continue;
                if (target === attacker) continue;
                target.addTag("dungeons:area_hit")
                system.runTimeout(() => {
                    if (target.isValid) target.removeTag("dungeons:area_hit")
                }, 1)
                const damageDone = specialDamage(attacker, target, damage, EntityDamageCause.entityAttack, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
                if (!damageDone) continue;
                const dir = getDirection(attacker.location, target.location);
                target.applyKnockback(makeVector(dir, 0.2), 0.3)
            }
            if (e.itemStack.typeId == "dungeons:rapier") dim.spawnParticle("dungeons:rapier_common", targetLoc)
            if (e.itemStack.typeId == "dungeons:bee_stinger") dim.spawnParticle("dungeons:rapier_honey", targetLoc)
            if (e.itemStack.typeId == "dungeons:freezing_foil") dim.spawnParticle("dungeons:rapier_freeze", targetLoc)
            dim.playSound("attack.sweep", targetLoc, { volume: 0.8, pitch: 1 })
        }
    });
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:rapier_sweep_t');
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