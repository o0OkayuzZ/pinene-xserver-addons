import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { specialDamage } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:gauntlets', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;
            var damage = 5
            if (unique == true) damage = 7
            damage += 1
            const dim = hit.dimension;
            const loc = attacker.location

            dim.playSound('game.player.attack.strong', loc, {
                volume: 1,
                pitch: 0.7
            });
            dim.playSound("weapon.gauntlets.hit", loc)
            dim.spawnParticle("minecraft:critical_hit_emitter", { x: hit.getHeadLocation().x, y: hit.getHeadLocation().y + 1, z: hit.getHeadLocation().z })
            system.runTimeout(() => {
                if (e.itemStack.hasTag("dungeons:swirling") || e.itemStack.getDynamicProperty("dungeons:gild") == "dungeons:swirling") {
                    world.scoreboard.getObjective('dungeons:swirling_t').setScore(attacker, 0)
                }
                dim.playSound("weapon.gauntlets.hit", loc)
                dim.playSound('game.player.attack.strong', attacker.location, {
                    volume: 1.1,
                    pitch: 0.7
                });
                dim.spawnParticle("minecraft:critical_hit_emitter", { x: hit.getHeadLocation().x, y: hit.getHeadLocation().y + 1, z: hit.getHeadLocation().z })
                const diddamage = specialDamage(attacker, hit, damage, EntityDamageCause.entityAttack, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
                if (diddamage == false) specialDamage(attacker, hit, 1, EntityDamageCause.entityAttack, ["weapon"])
            }, 10)

            if (!e.itemStack.hasTag("dungeons:triple_hit") && e.itemStack.getDynamicProperty("dungeons:gild") !== "dungeons:triple_hit") return;
            system.runTimeout(() => {
                if (hit.isValid == false) return;
                if (e.itemStack.hasTag("dungeons:swirling") || e.itemStack.getDynamicProperty("dungeons:gild") == "dungeons:swirling") {
                    world.scoreboard.getObjective('dungeons:swirling_t').setScore(attacker, 0)
                }

                dim.playSound("weapon.gauntlets.hit", loc)
                dim.playSound('game.player.attack.strong', attacker.location, {
                    volume: 1.3,
                    pitch: 0.75
                });
                dim.spawnParticle("minecraft:critical_hit_emitter", { x: hit.getHeadLocation().x, y: hit.getHeadLocation().y + 1, z: hit.getHeadLocation().z })
                const diddamage = specialDamage(attacker, hit, damage, EntityDamageCause.entityAttack, ["weapon", "apply_weakness", "apply_strength", "apply_melee_enchants"])
                if (diddamage == false) specialDamage(attacker, hit, 1, EntityDamageCause.entityAttack, ["weapon"])
            }, 20)
        }
    });
});
