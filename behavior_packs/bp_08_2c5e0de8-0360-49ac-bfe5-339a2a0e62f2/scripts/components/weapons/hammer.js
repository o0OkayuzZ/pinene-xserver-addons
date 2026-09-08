import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, makeVector, getDirection } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:hammer', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;

            var damage = 7
            if (unique == true) damage = 9
            const dim = attacker.dimension;
            const targetLoc = hit.location
            const damageRange = dim.getEntities({
                location: targetLoc,
                maxDistance: 3,
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
                const damageDone = specialDamage(attacker, target, damage, EntityDamageCause.entityAttack, ["weapon", "apply_weakness"])
                if (!damageDone) continue;
                if (e.itemStack.hasTag("dungeons:gravity") == false && e.itemStack.hasTag("dungeons:gravity_spooky") == false) {
                    target.applyKnockback(makeVector(getDirection(targetLoc, target.location), 1), 0.3)
                }
            }
            if (unique == true) {
                if (e.itemStack.typeId == "dungeons:hammer_of_gravity") {
                    dim.playSound("weapon.bone_club.crush", targetLoc, { pitch: 0.65 })
                    dim.spawnParticle("dungeons:hammer_dust_grav", targetLoc)

                } else if (e.itemStack.typeId == "dungeons:bonehead_hammer") {
                    dim.playSound("weapon.bone_club.hit", targetLoc, { pitch: 0.65 })
                    dim.playSound("mob.nameless_one.laugh", targetLoc, { pitch: 1.6, volume: 0.1 })
                    dim.spawnParticle("dungeons:hammer_dust", targetLoc)

                } else {
                    dim.playSound("weapon.bone_club.crush", targetLoc, { pitch: 0.5 })
                    dim.spawnParticle("dungeons:hammer_dust_storm", targetLoc)

                }
            } else {
                dim.playSound("weapon.bone_club.crush", targetLoc, { pitch: 0.5 })
                dim.spawnParticle("dungeons:hammer_dust", targetLoc)
                //hahaha
            }
        }
    });
});