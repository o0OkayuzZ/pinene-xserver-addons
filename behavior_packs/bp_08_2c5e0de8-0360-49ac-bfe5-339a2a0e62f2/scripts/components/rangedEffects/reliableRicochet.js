import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { isValidTarget } from "main.js"

const effectId = "dungeons:reliable_ricochet_bow_effect"

function findRicochet(hit, owner, array, spook, projectileId, projectileTags) {
    if (Math.random() > 0.75) {
        //return; commenting this out is literally all i got to change man
    }
    const damageRange = hit.dimension.getEntities({
        location: hit.location,
        maxDistance: 10
    });
    var target = undefined
    var possibleTargets = []
    for (const possibleTarget of damageRange) {
        if (target !== undefined) continue;
        if (isValidTarget(possibleTarget) == false) continue;
        if (possibleTarget == owner) continue;
        if (array.includes(possibleTarget)) continue;
        if (possibleTargets.includes(possibleTarget)) continue;
        possibleTargets.push(possibleTarget)
    }
    target = possibleTargets[Math.ceil(Math.random() * possibleTargets.length)]
    if (!target) return;
    const hloc = target.getHeadLocation()
    if (projectileId == "dungeons:torment_arrow") projectileId = "minecraft:arrow"
    const newArrow = target.dimension.spawnEntity(projectileId, { x: hloc.x, y: hloc.y + 0.1, z: hloc.z })
    const proj = newArrow.getComponent("projectile")
    proj.owner = owner
    newArrow.addTag("dungeons:multishot_arrow")
    newArrow.addTag("dungeons:ricochet_arrow")
    newArrow.addTag("dungeons:ignore_arrow_tags")
    newArrow.addTag("dungeons:crossbow_checked")
    for (const tag of projectileTags) if (tag !== effectId) newArrow.addTag(tag);
    proj.shoot({ x: 0, y: -1, z: 0 })
    const targetLoc = target.location;
    const hitLoc = hit.location;
    const xDif = targetLoc.x - hitLoc.x
    const yDif = targetLoc.y - hitLoc.y
    const zDif = targetLoc.z - hitLoc.z
    const distanceBetween = Math.hypot(hitLoc.x - targetLoc.x, hitLoc.y - targetLoc.y, hitLoc.z - targetLoc.z)
    for (let i = 1; i < distanceBetween; i++) {
        system.runTimeout(() => {
            if (projectileTags.includes("dungeons:bubble_bow_charged") == true) hit.dimension.spawnParticle("dungeons:bubble_bow_trail", { x: hitLoc.x + (xDif * (i / distanceBetween)), y: 1 + hitLoc.y + (yDif * (i / distanceBetween)), z: hitLoc.z + (zDif * (i / distanceBetween)) })
            hit.dimension.spawnParticle("dungeons:ricochet_shot", { x: hitLoc.x + (xDif * (i / distanceBetween)), y: 1 + hitLoc.y + (yDif * (i / distanceBetween)), z: hitLoc.z + (zDif * (i / distanceBetween)) })
        }, i / 2)
    }

    system.runTimeout(() => {
        target.dimension.spawnParticle('dungeons:ricochet_shot', target.location);
        target.dimension.playSound('weapon.enchant.ricochet', target.location);
        var newArray = array
        newArray.push(target)
        if (newArray.length > 15) return;
        findRicochet(target, owner, newArray, spook, projectileId, projectileTags)
    }, 1 + distanceBetween / 2);
}

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
    var spook = false
    if (projectile.hasTag("dungeons:haunted_bow_fired_by")) spook = true
    const id = projectile.typeId
    const projectileTags = projectile.getTags()
    system.run(() => {
        findRicochet(hurt, attacker, [hurt], spook, id, projectileTags)
    })

});