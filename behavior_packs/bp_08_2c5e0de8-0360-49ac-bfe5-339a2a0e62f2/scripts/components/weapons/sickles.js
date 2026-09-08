import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { specialDamage, makeVector, getDirection } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:sickles', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;
            var damage = 4
            if (unique == true) damage = 5
            damage += 1
            const dim = hit.dimension;
            const targetLoc = hit.location;
            var sound = "weapon.sickles.hit"
            dim.playSound(sound, attacker.location);
            const dir = getDirection(attacker.location, hit.location);
            hit.applyKnockback(makeVector(dir, 0.1), 0.1)
            attacker.playAnimation('animation.player.attack_daggers');
            system.runTimeout(() => {
                if (e.itemStack.hasTag("dungeons:swirling") || e.itemStack.getDynamicProperty("dungeons:gild") == "dungeons:swirling") {
                    world.scoreboard.getObjective('dungeons:swirling_t').setScore(attacker, 0)
                }
                dim.spawnParticle('dungeons:daggers_strike', targetLoc);
                dim.playSound(sound, attacker.location);
                const diddamage = specialDamage(attacker, hit, damage, EntityDamageCause.entityAttack, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
                if (diddamage == false) specialDamage(attacker, hit, 1, EntityDamageCause.entityAttack, ["weapon"])
                const dir2 = getDirection(attacker.location, hit.location);
                hit.applyKnockback(makeVector(dir2, 0.1), 0.1)
            }, 10)
        }
    });
});
