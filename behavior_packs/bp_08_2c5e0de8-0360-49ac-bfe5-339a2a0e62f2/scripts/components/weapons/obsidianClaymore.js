import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, makeVector, getDirection } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:obsidian_claymore', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;

            var damage = 8
            if (unique == true) damage = 12
            var damageRaise = 0
            var targetDummyDamageRaise = 0
            const dim = attacker.dimension;
            const targetLoc = hit.location
            const damageRange = dim.getEntities({
                location: targetLoc,
                maxDistance: 4,
                excludeFamilies: ['ignore']
            });
            if (e.itemStack.hasTag("dungeons:shared_pain")) {
                for (const target of damageRange) {
                    if (isValidTarget(target) == false) continue;
                    if (target === hit) continue;
                    if (target === attacker) continue;
                    if(target.typeId == "dungeons:target_dummy") {
                        targetDummyDamageRaise += 2.5
                    } else {
                        damageRaise += 2.5
                    }
                }
            }
            for (const target of damageRange) {
                if (isValidTarget(target) == false) continue;
                if (target === hit) continue;
                if (target === attacker) continue;
                var damageRaiseInstance = damageRaise
                if(target.typeId == "dungeons:target_dummy") damageRaiseInstance = targetDummyDamageRaise
                target.addTag("dungeons:area_hit")
                system.runTimeout(() => {
                    if (target.isValid) target.removeTag("dungeons:area_hit")
                }, 1)
                const damageDone = specialDamage(attacker, target, damage + (damageRaiseInstance * 1.5), EntityDamageCause.entityAttack, ["weapon", "apply_weakness"])
                if (!damageDone) continue;
                if (e.itemStack.hasTag("dungeons:gravity") == false && e.itemStack.hasTag("dungeons:gravity_spooky") == false) {
                    if (damageRaiseInstance < 10) target.applyKnockback(makeVector(getDirection(targetLoc, target.location), 1 + (damageRaiseInstance / 15)), 0.3 + (damageRaiseInstance / 25))
                    if (damageRaiseInstance >= 10) target.applyKnockback(makeVector(getDirection(targetLoc, target.location), 1 + (10 / 15)), 0.3 + (10 / 25))
                }
            }
            if (unique == true) {
                dim.playSound("weapon.obsidian_claymore.hit.unique", targetLoc)
                dim.playSound("weapon.enchant.exploding", targetLoc, { pitch: 1.2 })
                dim.spawnParticle("dungeons:starless_night_1", targetLoc)
                dim.spawnParticle("dungeons:starless_night_2", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
                dim.spawnParticle("dungeons:starless_night_3", { x: targetLoc.x, y: targetLoc.y + 0.1, z: targetLoc.z })
            } else {
                dim.playSound("weapon.obsidian_claymore.hit.common", targetLoc)
                dim.spawnParticle("dungeons:obsidian_dust", { x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z })
            }
        }
    });
});