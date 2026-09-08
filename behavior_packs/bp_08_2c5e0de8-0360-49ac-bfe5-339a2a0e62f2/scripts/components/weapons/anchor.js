import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, gravityTo } from "main.js";
system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:anchor', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;

            var damage = 10
            if (unique == true) damage = 12
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
                target.applyKnockback({ x: 0, z: 0 }, 0.3)
            }
            if (unique == true) {
                dim.spawnParticle("dungeons:encrusted_dust", targetLoc)
                dim.spawnParticle("dungeons:encrusted_dust", targetLoc)
                dim.spawnParticle("dungeons:encrusted_anchor_smoke", targetLoc)
            } else {
                dim.spawnParticle("dungeons:hammer_dust", targetLoc)
                dim.spawnParticle("dungeons:hammer_dust", targetLoc)
                dim.spawnParticle("dungeons:anchor_smoke", targetLoc)
            }
            //dim.spawnParticle("dungeons:gravity", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
            dim.playSound("weapon.anchor.hit", targetLoc, { volume: 0.8 })
            dim.playSound("weapon.bone_club.crush", targetLoc, { volume: 0.4, pitch: 0.25 })
            dim.playSound("random.anvil_land", targetLoc, { volume: 0.4, pitch: 0.4 })
            const gravityTargets = dim.getEntities({
                location: targetLoc,
                maxDistance: 4,
                excludeFamilies: ['ignore', 'gravity_immune']
            });
            for (const target of gravityTargets) {
                if (target == attacker || target == hit || isValidTarget(target) == false) continue;
                gravityTo(target, targetLoc)
            }
        }
    });
});