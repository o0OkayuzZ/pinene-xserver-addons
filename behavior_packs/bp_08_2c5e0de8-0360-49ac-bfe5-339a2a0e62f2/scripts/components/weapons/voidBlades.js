import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { specialDamage } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:void_blades', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;
            var damage = 3
            if (unique == true) damage = 5
            damage += 1
            const dim = hit.dimension;
            const targetLoc = hit.location;


            attacker.playAnimation('animation.player.attack_void_blades');
            system.runTimeout(() => {
                if (e.itemStack.hasTag("dungeons:swirling") || e.itemStack.getDynamicProperty("dungeons:gild") == "dungeons:swirling") {
                    world.scoreboard.getObjective('dungeons:swirling_t').setScore(attacker, 0)
                }
                if (hit.isValid == false) return;
                dim.spawnParticle('dungeons:void_blades_strike', targetLoc);
                const diddamage = specialDamage(attacker, hit, damage, EntityDamageCause.entityAttack, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
                if (diddamage == false) specialDamage(attacker, hit, 1, EntityDamageCause.entityAttack, ["weapon"])
            }, 15)
        }
    });
});
