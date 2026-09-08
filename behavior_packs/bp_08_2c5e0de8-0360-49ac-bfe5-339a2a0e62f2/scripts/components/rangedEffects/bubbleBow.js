import {
    world,
    system,
    EntityDamageCause,
    DimensionTypes,
    MolangVariableMap
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:bubble_bow_effect"

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
    if (!projectile.hasTag("dungeons:bubble_bow_charged")) return;
    const hp = hurt.getComponent("health")
    if (hp && hp.currentValue <= 0) return
    if (hurt.matches({ families: ["boss"] })) return;

    if (hurt.matches({ families: ["gravity_immune"] })) return;
    system.run(() => {
        var cd = world.scoreboard.getObjective('dungeons:bubbled_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:bubbled_t');
        }
        if (cd.hasParticipant(hurt)) {
            return;
        }
        hurt.addTag("dungeons:bubbled")
        const dim = hurt.dimension;
        const loc = hurt.location
        var map = new MolangVariableMap()
        dim.playSound("bubble_bow.spawn", loc)
        if (hurt.isInWater) {
            map.setFloat("variable.particle_max_lifetime", 3)
            cd.setScore(hurt, 60)
            hurt.clearVelocity()
        } else {
            map.setFloat("variable.particle_max_lifetime", 2)
            cd.setScore(hurt, 40)
            hurt.clearVelocity()
        }

        const box = hurt.getAABB()
        var h = Math.round(box.extent.y * 100) / 50
        var w = Math.round(box.extent.x * 100) / 50
        if (w > h) {
            if (w > 5) w = 5
            if (w < 1) w = 1
            map.setFloat("variable.particle_size", w)
        } else {
            if (h > 5) h = 5
            if (h < 1) h = 1
            map.setFloat("variable.particle_size", h * 0.9)
        }
        dim.spawnParticle("dungeons:bubble_effect_new", loc, map)

    })
});



world.afterEvents.itemReleaseUse.subscribe((e) => {
    var item = e.itemStack;
    const player = e.source;
    if (!item) return;
    if (item.hasTag("dungeons:bubble")) {
        if (199980 - e.useDuration >= 19) {
            for (const entity of player.dimension.getEntities({ maxDistance: 15, location: player.location })) {
                if (!entity) continue;
                if (!entity.isValid) continue;
                if (arrowTypes.includes(entity.typeId) == false) continue;
                if (entity.hasTag("dungeons:crossbow_checked")) continue;
                if (entity.hasTag("dungeons:bubble_bow_effect")) {
                    const projectile = entity.getComponent("projectile")
                    if (!projectile || !projectile.owner) continue;
                    if (projectile.owner !== player) continue;
                    entity.addTag("dungeons:bubble_bow_charged")
                }
            }
        }
    }
})

system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (let entity of dim.getEntities({ tags: ["dungeons:bubble_bow_charged"] })) {
            if (!entity.isOnGround && entity.dimension.isChunkLoaded(entity.location)) {
                entity.dimension.spawnParticle('dungeons:bubble_bow_trail', entity.location);
            }
        }
    }
})
//cooldown
system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ tags: ["dungeons:bubbled"] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:bubbled_t');
            if (!timeLeft) return world.scoreboard.addObjective("dungeons:bubbled_t");
            if (!entity.scoreboardIdentity) continue;
            if (!timeLeft.hasParticipant(entity.scoreboardIdentity)) continue;
            let duration = timeLeft.getScore(entity);

            if (duration > 0) {
                timeLeft.addScore(entity, -1);
                entity.clearVelocity()
                const isOnFire = entity.getComponent("onfire")
                if (isOnFire) {
                    entity.extinguishFire()
                }
                entity.addEffect("fire_resistance", 2, { showParticles: false })
                entity.addEffect("water_breathing", 2, { showParticles: false })
            }
            if (duration <= 0) {
                timeLeft.removeParticipant(entity)
                entity.removeTag("dungeons:bubbled")
                dim.playSound("bubble_bow.pop", entity.location)
            }
        }
    }
})

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.hasTag("dungeons:bubbled")) {

        var timeLeft = world.scoreboard.getObjective('dungeons:bubbled_t');
        if (!timeLeft) return;
        if (timeLeft.getScore(hurt) == 40 || timeLeft.getScore(hurt) == 60) return;
        timeLeft.removeParticipant(hurt)
        hurt.removeTag("dungeons:bubbled")
        hurt.dimension.playSound("bubble_bow.pop", hurt.location)
    }
})