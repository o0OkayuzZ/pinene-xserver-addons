import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

//projectiles
world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == "dungeons:poison_quill") {
        if (!entity.isValid) return;
        dim.playSound("mob.poison_quill_vine.emerge", loc)
        entity.remove()
        return;
    }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
    const entity = e.projectile;
    const hit = e.getEntityHit().entity
    if (!hit.isValid) return;
    const dim = hit.dimension
    const loc = e.location;
    if (entity.typeId == "dungeons:poison_quill" || entity.typeId == "dungeons:anemone_quill") {
        system.runTimeout(() => {
            if (entity.isValid) entity.remove()
        }, 100)
        if (!entity.isValid) return;
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner || !owner.isValid) {
            entity.remove()
            return;
        }
        if (hit.matches({ families: ["undead"] })) return;
        if (hit.matches({ families: ["monster"] })) return;
        if (hit.matches({ families: ["ignore"] })) return;
        if (hit.matches({ families: ["inanimate"] })) return;
        var soundId = undefined
        var dmg = 1.5
        if (owner.typeId == "dungeons:poison_quill_vine") {
            dmg = 2
            soundId = "mob.poison_quill_vine.hit"
        } else if (owner.typeId == "dungeons:poison_anemone") {
            dmg = 2
            soundId = "mob.poison_anemone.hit"
        }
        const dmgDone = hit.applyDamage(dmg, { damagingEntity: owner, cause: EntityDamageCause.magic })
        if(dmgDone) {
            if(soundId) dim.playSound(soundId, hit.location)
            hit.addEffect("poison", 60, { amplifier: 2 })
        }

        entity.remove()
    }
})
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (projectile.typeId !== "dungeons:poison_quill" && projectile.typeId !== "dungeons:anemone_quill") return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;

    if (hit.matches({ families: ["undead"] }) || hit.matches({ families: ["monster"] })) {
        e.cancel = true;
        e.damage = 0
    }

});