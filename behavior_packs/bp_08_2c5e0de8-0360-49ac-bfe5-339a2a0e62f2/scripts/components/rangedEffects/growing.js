import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"
import { getDirection, makeVector, isValidTarget, specialDamage } from "main.js"
const effectId = "dungeons:growing_bow_effect"
const dimIds = ["overworld", "nether", "the_end"]

system.runInterval(() => {
    for (let dimId of dimIds) {
        for (let entity of world.getDimension(dimId).getEntities({
            tags: [effectId]
        })) {
            entity.playAnimation("animation.arrow.scale")
            const scale = entity.getProperty("dungeons:scale")
            if (scale < 40 && !entity.isOnGround) {
                entity.setProperty("dungeons:scale", scale + 1)
            }
            if (scale > 10 && scale <= 39 && !entity.isOnGround && (scale - 1) % 9 == 0) entity.triggerEvent("dungeons:scale_" + `${(scale)}`)
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
    const scale = projectile.getProperty("dungeons:scale")
    var damageBuff = scale / 10
    e.damage = e.damage * damageBuff
    const dir = getDirection(projectile.location, hurt.location)
    system.run(() => {
        hurt.applyKnockback(makeVector(dir, scale / 3 / 1.5), 0.33)
    })

});