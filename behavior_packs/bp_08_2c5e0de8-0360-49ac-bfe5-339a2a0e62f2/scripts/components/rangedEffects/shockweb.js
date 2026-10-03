import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector, isValidTarget, specialDamage } from "main.js"

const effectId = "dungeons:shockweb_bow_effect"

function shockweb(entity, tagId, owner) {
    const loc = entity.location
    const dim = entity.dimension
    const others = dim.getEntities({
        location: loc,
        maxDistance: 8,
        minDistance: 2,
        closest:3,
        tags: [tagId]
    })
    for (const other of others) {
        if (!other.hasTag("dungeons:connecting_arrow_" + `${entity.id}`)) {
            connectLine(other.location, loc, dim, owner)
            entity.addTag("dungeons:connecting_arrow_" + `${entity.id}`)
        }
    }
}

const it = 18

function connectLine(targetLoc, baseLoc, baseDim, owner) {
    const baseDist = Math.hypot(baseLoc.x - targetLoc.x, baseLoc.y - targetLoc.y, baseLoc.z - targetLoc.z)
    for (let i = 1; i < it; i += it / baseDist) {
        system.runTimeout(() => {
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            const hitLoc = { x: baseLoc.x + (xDif * (i / it)), y: baseLoc.y + (yDif * (i / it)), z: baseLoc.z + (zDif * (i / it)) }
            if(baseDim.isChunkLoaded(hitLoc)) {
                baseDim.spawnParticle("dungeons:shockweb_connection", hitLoc)
                baseDim.spawnParticle("dungeons:shockweb_connection_inner", hitLoc)
            }
            const damageRange = baseDim.getEntities({
                location: hitLoc,
                maxDistance: 1,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                if (isValidTarget(target) == false) continue;
                if (target === owner) continue;
                if (owner.isValid) {
                    specialDamage(owner, target, 8, EntityDamageCause.lightning, ["lightning"])
                } else {
                    target.applyDamage(8, { cause: EntityDamageCause.lightning })
                }
            }
        })
    }
}


world.afterEvents.projectileHitBlock.subscribe((e) => {
    const projectile = e.projectile
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const player = e.source;
    if (!player) return;
    if (!player.isValid) return;
    if (!projectile.hasTag(effectId)) return;
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    const tagId = "dungeons:connect_to_" + `${player.id}`
    projectile.addTag(tagId)
    for (let i = 0; i < 35; i++) {
        system.runTimeout(() => {
            if (!projectile.isValid) return;
            shockweb(projectile, tagId, player)
        }, i * 7)
    }

    system.runTimeout(() => {
        if (!projectile.isValid) return;
        projectile.removeTag(tagId)
        for (const tag of projectile.getTags()) if (tag.includes("dungeons:connecting_arrow_")) projectile.removeTag(tag)
    }, 101)
})