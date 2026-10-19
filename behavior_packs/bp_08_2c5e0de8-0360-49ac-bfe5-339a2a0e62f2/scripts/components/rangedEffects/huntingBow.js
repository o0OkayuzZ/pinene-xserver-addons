import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector, isValidTarget, specialDamage } from "main.js"

const effectId = "dungeons:hunting_bow_bow_effect"


world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (!projectile.hasTag(effectId)) return;
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
        system.run(() => {
            var cd = world.scoreboard.getObjective('dungeons:hunting_bow_t');
            if (!cd) {
                cd = world.scoreboard.addObjective('dungeons:hunting_bow_t');
            }
            if (cd.hasParticipant(attacker.scoreboardIdentity)) {
                return;
            }
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            system.runTimeout(() => {
                cd.setScore(attacker, 80)
            }, 5)
            var playerSummons = []
            const pets = hurt.dimension.getEntities({ location: hurtLoc, maxDistance: 64, families: ["artefact", "pet"] })
            for (const pet of pets) {
                const tameable = pet.getComponent("tameable")
                if (!tameable) continue;
                const owner = tameable.tamedToPlayer
                if (!owner || owner !== attacker) continue;
                playerSummons.push(pet)
            }
            if (playerSummons.length == 0) return
            for(const summon of playerSummons) {
                summon.applyDamage(0.01, { damagingEntity: hurt, cause: "override" })
            }
        })

});