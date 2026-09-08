import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:battlestaff', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;

            var cooldown = world.scoreboard.getObjective('dungeons:battlestaff_sweep_t');
            if (!cooldown) {
                cooldown = world.scoreboard.addObjective('dungeons:battlestaff_sweep_t');
            }
            if (cooldown.hasParticipant(attacker.scoreboardIdentity)) {
                cooldown.setScore(attacker, 15);
                return;
            };
            cooldown.setScore(attacker, 12);

            var damage = 4
            if (unique == true) damage = 6
            const dim = attacker.dimension;
            const targetLoc = hit.location
            const damageRange = dim.getEntities({
                location: targetLoc,
                maxDistance: 4.5,
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
                target.applyKnockback(makeVector(dir, 0.66), 0.33)
            }
            dim.spawnParticle("dungeons:battlestaff", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
            dim.playSound("attack.sweep", targetLoc, { volume: 0.3, pitch: 0.7 })
            if (e.itemStack.typeId == "dungeons:growing_staff") {
                dim.playSound("weapon.battlestaff.hit.growing", targetLoc, { volume: 0.66 })

            } else if (e.itemStack.typeId == "dungeons:battlestaff_of_terror") {
                dim.playSound("weapon.battlestaff.hit.terror", targetLoc, { volume: 0.66 })
            } else {
                dim.playSound("weapon.battlestaff.hit.common", targetLoc, { volume: 0.66 })

            }
        }
    });
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:battlestaff_sweep_t');
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