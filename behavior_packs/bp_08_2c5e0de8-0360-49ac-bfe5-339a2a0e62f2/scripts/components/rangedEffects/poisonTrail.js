import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:poison_trail_bow_effect"

const dimensionIds = ["overworld", "nether", "the_end"];
import { isValidTarget } from "main.js"
import { arrowTypes } from "components/ranged.js"

system.runInterval(() => {
    for (let dimId of dimensionIds) {
        for (let entity of world.getDimension(dimId).getEntities({ tags: [effectId] })) {
            if (!entity.isOnGround && entity.dimension.isChunkLoaded(entity.location)) {
                const dim = entity.dimension;
                const loc = { x: entity.location.x, y: entity.location.y - 1, z: entity.location.z };
                dim.spawnParticle("dungeons:poison_trail_bow", loc)
                const proj = entity.getComponent("projectile")
                const owner = proj.owner
                if (!owner) {
                    entity.removeTag(effectId)
                }
                for (let i = 0; i < 30; i++) {
                    system.runTimeout(() => {
                        const damageRange = dim.getEntities({
                            location: loc,
                            maxDistance: 2,
                            excludeFamilies: ['ignore']
                        });
                        for (const target of damageRange) {
                            if (target == owner) continue;
                            if (isValidTarget(target) == false) continue;
                            if (target.getEffect("fatal_poison")) continue;
                            target.addEffect("fatal_poison", 100, { amplifier: 2 })

                        }
                    }, i)
                }
            }
        }
    }
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
    if (e.damage <= 0) return;
    system.run(() => {
        if (hurt.getEffect("fatal_poison")) return;
        hurt.addEffect("fatal_poison", 60, { amplifier: 2 })
    })

});