import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, makeVector, getDirection } from "main.js"

//melee aoe
world.afterEvents.entityHitEntity.subscribe((event) => {
    const hurtEntity = event.hitEntity;
    const damageSource = event.damagingEntity;
    if (damageSource.typeId === "dungeons:tempest_golem") {
        const nearbyMobs = hurtEntity.dimension.getEntities({
            location: hurtEntity.location,
            maxDistance: 3,
            excludeFamilies: ['monster', 'ignore']
        });
        for (const mob of nearbyMobs) {
            if (isValidTarget(mob) && mob.matches({ families: ["player"] })) {
                if (mob !== hurtEntity) {
                    mob.applyDamage(8, {
                        cause: EntityDamageCause.entityAttack,
                        damagingEntity: damageSource
                    });
                }
                if (mob.typeId === 'minecraft:player') {
                    mob.runCommand('camerashake add @s 0.1 0.33 positional');
                    mob.runCommand('camerashake add @s 0.1 0.66 positional');
                    mob.runCommand('camerashake add @s 0.1 1 positional');
                }
                const dir = getDirection(hurtEntity.location, mob.location);
                mob.applyKnockback(makeVector(dir, 2), 0.3)
            }
        }
    }
});

//spawn egg
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const item = event.itemStack;
    const player = event.player;

    if (!item || !player) return;
    if (player.hasTag('dungeons:tempest_warn')) return;

    if (item.typeId === 'dungeons:tempest_golem_resting_spawn_egg') {
        player.sendMessage("§7テンペストゴーレムにダメージを与えるには、近くに wind_totem_left と wind_totem_right を配置する必要があります。")

        system.run(() => {
            player.addTag('dungeons:tempest_warn');
        });
    }
})



//tempest_lightning
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:tempest_lightning' && entity.typeId == "dungeons:tempest_lightning") {
        var loc = entity.location;
        const dim = entity.dimension;
        var nearbyTempestGolem = dim.getEntities({ maxDistance: 32, location: loc, type: "dungeons:tempest_golem" })
        dim.spawnParticle("dungeons:tempest_zap_circle", { x: loc.x, y: loc.y + 0.126, z: loc.z })
        dim.spawnParticle("dungeons:tempest_zap_warn", { x: loc.x, y: loc.y - 0.126, z: loc.z })
        dim.playSound("block.bell.hit", loc, { volume: 1.5, pitch: 1.8 })
        system.runTimeout(() => {
            if (nearbyTempestGolem.length > 0) {
                zapMobs(loc, dim, nearbyTempestGolem[0])
                if (Math.random() > 0.3) totemCheck(nearbyTempestGolem[0])
            }
            if (nearbyTempestGolem.length == 0) zapMobs(loc, dim, undefined)
        }, 40)
        entity.remove()
    }
});
function zapMobs(loc, dim, tempestGolem) {
    dim.spawnParticle("dungeons:lightning_wand_shock", loc)
    dim.spawnParticle("dungeons:tempest_golem_zap", loc)
    dim.playSound("artefact.lightningwand.strike", loc)
    dim.playSound("weapon.enchant.thundering", loc)
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 4,
        excludeFamilies: ['ignore', 'monster']
    });
    for (const target of damageRange) {
        var damage = 20
        var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 2
        damage -= distanceBetween
        if (tempestGolem && tempestGolem.isValid) {
            if (isValidTarget(target) == false && !target.matches({ families: ["player"] })) continue;
            const damageDone = target.applyDamage(damage, { damagingEntity: tempestGolem, cause: EntityDamageCause.lightning })
            if (damageDone) {
                target.applyKnockback({ x: 0, z: 0 }, 1.5)
            }
        } else {
            if (isValidTarget(target) == false && !target.matches({ families: ["player"] })) continue;
            const damageDone = target.applyDamage(damage, { cause: EntityDamageCause.lightning })
            if (damageDone) {
                target.applyKnockback({ x: 0, z: 0 }, 1.5)
            }
        }
    }
}


function totemCheck(entity) {
    var hasLeftTotem = false
    var hasRightTotem = false
    for (const target of entity.dimension.getEntities({ location: entity.location, maxDistance: 32, families: ["wind_totem"] })) {
        if (target.typeId == "dungeons:wind_totem_right") hasRightTotem = true
        if (target.typeId == "dungeons:wind_totem_left") hasLeftTotem = true
    }
    if (!hasLeftTotem) entity.triggerEvent("dungeons:disable_left_arm")
    if (!hasRightTotem) entity.triggerEvent("dungeons:disable_right_arm")
}