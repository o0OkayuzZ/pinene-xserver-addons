import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { multiShot } from "components/ranged/crossbowLoading.js"
const effectId = "dungeons:bow_multishot_bow_effect"


world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!arrowTypes.includes(entity.typeId)) return;
    system.runTimeout(() => {
        if (!entity || !entity.isValid) return;
        if (entity.hasTag(effectId) && !entity.hasTag("dungeons:multishot_arrow")) {
            const owner = entity.getComponent("projectile").owner
            if(!owner) return;
            multiShot(3, entity.typeId, owner, undefined, entity.getVelocity())
        }
    }, 1)
})

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
    const spooky = projectile.hasTag("dungeons:webbed_bow_fired_by")
    if (e.damage <= 0) return;
    system.run(() => {
        const dim = hurt.dimension;
        const loc = hurt.location
        if (spooky == true && hurt.isOnGround) {
            dim.spawnParticle("dungeons:webbed_bow", loc)
            dim.playSound("mob.player.hurt.freeze", loc, { pitch: 0.5 })
        }
    })

});

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (let entity of dim.getEntities({ tags: ["dungeons:webbed_bow_fired_by"] })) {
            if (!entity.isOnGround && dim.isChunkLoaded(entity.location)) {
                dim.spawnParticle("minecraft:weaving_ambient", entity.location);
            }
        }
    }
})