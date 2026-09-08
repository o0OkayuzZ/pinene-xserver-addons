import {
    world,
    system,
    EntityDamageCause,
    DimensionTypes
} from "@minecraft/server";

import { isValidTarget, getDirection, makeVector } from "main.js"

//spawn egg
world.beforeEvents.playerInteractWithBlock.subscribe((event) => {
    const item = event.itemStack;
    const player = event.player;

    if (!item || !player) return;
    if (player.hasTag('dungeons:guardian_warn')) return;
    if (player.isInWater) return;
    if (item.typeId === 'dungeons:ancient_guardian_resting_spawn_egg') {
        player.sendMessage("§7このボスは水中向けです。陸上に出現させると正常に動作しない場合があります。")

        system.run(() => {
            player.addTag('dungeons:guardian_warn');
        });
    }
})

//attack particles
world.afterEvents.entityHurt.subscribe((event) => {
    const hurtEntity = event.hurtEntity;
    const damageSource = event.damageSource.damagingEntity;
    const cause = event.damageSource.cause;
    if (!damageSource) return;
    if (cause == "thorns") return;
    if (damageSource.typeId === "dungeons:ancient_guardian") {
        hurtEntity.dimension.spawnParticle('dungeons:scatter_mine_boom', hurtEntity.location);
    }
});

function biomineExplosion(loc, dim) {

    dim.spawnParticle("dungeons:forge_core_dust", { x: loc.x, y: loc.y + 1, z: loc.z })
    dim.spawnParticle("dungeons:teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
    dim.spawnParticle("dungeons:teleport_boom_dust", { x: loc.x, y: loc.y + 0.5, z: loc.z })
    dim.playSound("mob.biomine.splash", loc)
    dim.playSound("mob.ghast.fireball", loc, { pitch: 0.5, volume: 0.5 })
    dim.playSound("random.explode", loc, { pitch: 0.33, volume: 0.5 })
    const nearbyMines = dim.getEntities({
        location: loc,
        maxDistance: 3,
        minDistance: 1,
        type: "dungeons:biomine"
    });
    for (const mine of nearbyMines) {
        system.runTimeout(() => {
            if (mine.isValid) mine.triggerEvent("dungeons:explode")
        }, 5)
    }
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 5,
        excludeFamilies: ['ignore', 'monster']
    });
    for (const target of damageRange) {
        if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
            var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z) * 4)
            const damage = target.applyDamage(20 - distanceBetween, { cause: EntityDamageCause.entityExplosion });
            if (damage) {
                if (target.typeId == "minecraft:player") {
                    target.runCommand("camerashake add @s 0.2 1")
                    target.runCommand("camerashake add @s 0.2 0.5")
                }
                const dir = getDirection(loc, target.location);
                target.applyKnockback(makeVector(dir, 1.2), 0.3)
            }
        }
    }
    createPoisonCloud(15, dim, loc)
}

// cloud
function createPoisonCloud(timeLeft, dim, loc) {
    if (dim.isChunkLoaded(loc) == true) {
        if (timeLeft <= 0) return;
        if (timeLeft > 1) {
            dim.spawnParticle("dungeons:poison_cloud_smoke", loc)
            dim.spawnParticle("dungeons:poison_cloud_swirls", loc)
        }
        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 4,
            excludeFamilies: ['ignore', "monster"]
        });
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            var damage = 2
            const damageDone = target.applyDamage(damage, { cause: EntityDamageCause.magic })
            if (damageDone) {
                target.applyKnockback({ x: 0, z: 0 }, -0.01)
                target.addEffect("fatal_poison", 11)
            }
        }
    }
    system.runTimeout(() => {
        createPoisonCloud(timeLeft - 1, dim, loc)
    }, 10)
}

//explode
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:explode' && entity.typeId == "dungeons:biomine") {
        var loc = entity.location;
        const dim = entity.dimension;
        biomineExplosion(loc, dim)
        entity.remove()
    }
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:biomine") {
        var loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:teleport_in", { x: loc.x, y: loc.y - 0.75, z: loc.z })
        dim.spawnParticle("dungeons:guardian_spawn", loc)
    }
});


//minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:guardian' && entity.typeId == "dungeons:guardian_spawnpoint") {
        var loc = entity.location;
        const dim = entity.dimension;

        dim.spawnParticle("dungeons:guardian_spawn", loc)
        dim.spawnParticle("dungeons:teleport_out", { x: loc.x, y: loc.y - 0.75, z: loc.z })
        dim.playSound("mob.evocation_illager.prepare_summon", loc, { volume: 0.5, pitch: 2 + Math.random() })

        spawned("minecraft:guardian", loc, dim)
        entity.remove()
    }
});

function spawned(id, loc, dim) {
    const entity = dim.spawnEntity(id, loc)
    entity.addTag("dungeons:ancient_guardian_minion")
}

system.runInterval(() => {
    for (const dimId of DimensionTypes.getAll()) {
        for (const mob of world.getDimension(dimId.typeId).getEntities({ tags: ["dungeons:ancient_guardian_minion"] })) {

            var loc = mob.location;
            const dim = mob.dimension;
            const necromancerNearby = dim.getEntities({ location: loc, maxDistance: 64, type: "dungeons:ancient_guardian" })
            if (necromancerNearby.length == 0) {
                dim.spawnParticle("dungeons:guardian_spawn", loc)
                dim.spawnParticle("dungeons:teleport_out", { x: loc.x, y: loc.y - 0.75, z: loc.z })
                mob.remove()
            }
        }
    }
})