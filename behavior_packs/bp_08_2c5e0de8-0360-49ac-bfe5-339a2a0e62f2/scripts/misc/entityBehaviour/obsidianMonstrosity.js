
import {
    world,
    system,
    EntityDamageCause,
    DimensionTypes
} from "@minecraft/server";

import { isValidTarget, getDirection, makeVector } from "main.js"

//bombs
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (entity.typeId !== "dungeons:obsidian_scatter_mine") return;
    if (id == "dungeons:scatter_mine") {
        var loc = entity.location;
        const dim = entity.dimension;
        const xOffset = Math.random() * 3 - 1.5
        const zOffset = Math.random() * 3 - 1.5
        const newLoc = { x: loc.x + xOffset, y: loc.y, z: loc.z + zOffset }
        var tp = entity.tryTeleport(newLoc)
        if (tp) loc = newLoc
        system.runTimeout(() => {

            dim.playSound("weapon.enchant.exploding", loc, { volume: 2, pitch: 2 + Math.random() * 0.4 })
            dim.spawnParticle("dungeons:obsidian_lightning_strike", loc)
        }, 20)
    }
    if (id === 'dungeons:obsidian_scatter_mine_explode') {
        if (!entity.isValid) return;
        var loc = entity.location;
        const dim = entity.dimension;
        dim.spawnParticle("dungeons:endersent_teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
        dim.spawnParticle("dungeons:endersent_teleport_boom_dust", loc)
        dim.playSound("random.explode", loc, { pitch: 0.5 })
        dim.playSound("armour.teleport.explode", loc)
        entity.remove()

        const targets = dim.getEntities({ location: loc, maxDistance: 6 })
        for (const target of targets) {
            if (target.typeId == "minecraft:vindicator") continue;
            if ((isValidTarget(target) || target.matches({ families: ["player"] }))) {
                const damage = target.applyDamage(20, { cause: EntityDamageCause.entityExplosion })
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.15 2")
                        target.runCommand("camerashake add @s 0.15 1.5")
                        target.runCommand("camerashake add @s 0.15 1")
                        target.runCommand("camerashake add @s 0.15 0.5")
                    }
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 0.6), 0.4)
                }
            }
        }

        for (const mine of dim.getEntities({ type: entity.typeId, maxDistance: 5, minDistance: 0.5, location: loc })) {
            system.runTimeout(() => {
                if (mine.isValid) mine.triggerEvent("dungeons:obsidian_scatter_mine_explode")
            }, 3)
        }
    }
});


//projectiles

function projectileexplosion(loc, dim, owner, entity) {
    dim.spawnParticle("dungeons:obsidian_shockwave", loc)
    dim.spawnParticle("dungeons:endersent_teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
    dim.spawnParticle("dungeons:endersent_teleport_boom_dust", loc)
    dim.playSound("random.explode", loc, { volume: 2, pitch: 1.5 })
    dim.playSound("weapon.enchant.exploding", loc, { volume: 2, pitch: 0.4 + Math.random() * 0.4 })
    const targets = dim.getEntities({ location: loc, maxDistance: 6 })
    for (const target of targets) {
        if (target.typeId == "minecraft:vindicator") continue;
        if ((isValidTarget(target) || target.matches({ families: ["player"] })) && target !== owner) {
            const damage = target.applyDamage(13, { cause: EntityDamageCause.entityExplosion, damagingEntity: owner })
            if (damage) {
                if (target.typeId == "minecraft:player") {
                    target.runCommand("camerashake add @s 0.1 1.5")
                    target.runCommand("camerashake add @s 0.1 1")
                    target.runCommand("camerashake add @s 0.1 0.5")
                }
                const dir = getDirection(loc, target.location);
                target.applyKnockback(makeVector(dir, 0.6), 0.4)
            }
        }
    }
    system.run(() => {
        if (entity.isValid) entity.remove()
    })
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    const cause = e.cause;
    if (cause !== "Spawned") return;
    if (entity.typeId == "dungeons:obsidian_monstrosity_projectile") {

        const proj = entity.getComponent("projectile")
        if (!proj) return;
        const owner = proj.owner;
        if (!owner) {
            entity.dimension.playSound("mob.redstone_monstrosity.shoot", entity.location, { volume: 2 })
        } else {
            owner.dimension.playSound("mob.redstone_monstrosity.shoot", owner.location, { volume: 2 })

        }
    }
})

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == "dungeons:obsidian_monstrosity_projectile") {
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner) {
            entity.remove()
            return;
        }
        projectileexplosion(loc, dim, owner, entity)
    }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
    const entity = e.projectile;
    const hit = e.getEntityHit().entity
    if (!hit.isValid) return;
    const dim = hit.dimension
    const loc = e.location;
    if (entity.typeId == "dungeons:obsidian_monstrosity_projectile") {
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner) {
            entity.remove()
            return;
        }
        projectileexplosion(loc, dim, owner, entity)
    }
})


//melee attack used
function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 122)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    dim.playSound("random.break", targetLoc, { pitch: 0.6 })
    dim.spawnParticle("minecraft:critical_hit_emitter", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:melee_attack_used' && entity.typeId == "dungeons:obsidian_monstrosity") {
        var loc = entity.location;
        const dim = entity.dimension;
        const vd = entity.getViewDirection();
        const impactPoint = { x: loc.x + vd.x * 11, y: loc.y + 0.2, z: loc.z + vd.z * 11 }
        dim.spawnParticle("dungeons:obsidian_shockwave", impactPoint)
        const damageRange = dim.getEntities({
            location: impactPoint,
            maxDistance: 8,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            var damage = false
            if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                if (target.matches({ families: ["monster"] })) continue;
                if (target.typeId == "minecraft:vindicator") continue;
                var distanceBetween = Math.round(Math.hypot(impactPoint.x - target.location.x, impactPoint.y - target.location.y, impactPoint.z - target.location.z)) * 2
                damage = target.applyDamage(24 - distanceBetween, { cause: EntityDamageCause.entityAttack });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.1 2.5")
                        target.runCommand("camerashake add @s 0.1 1.55")
                        target.runCommand("camerashake add @s 0.1 1.5")
                        target.runCommand("camerashake add @s 0.1 0.55")
                    }
                    const dir = getDirection(impactPoint, target.location);
                    target.applyKnockback(makeVector(dir, 1.7), 0.3)
                }
                if (target.typeId == "minecraft:player") {
                    const isShieldReady = target.getItemCooldown("minecraft:shield")
                    if (isShieldReady > 0) continue;
                    if (target.isSneaking == false) continue;
                    const equippable = target.getComponent("equippable")
                    if (!equippable) continue;
                    const mainHand = equippable.getEquipment("Mainhand")
                    if (mainHand !== undefined) {
                        if (mainHand.typeId == "minecraft:shield") {
                            const dir = getDirection(impactPoint, target.location);
                            if (!damage) target.applyKnockback(makeVector(dir, 1), 0.3)
                            disableShield(target)
                            continue;
                        }
                    }
                    const offhand = equippable.getEquipment("Offhand")
                    if (offhand !== undefined) {
                        if (offhand.typeId == "minecraft:shield") {
                            const dir = getDirection(impactPoint, target.location);
                            if (!damage) target.applyKnockback(makeVector(dir, 1), 0.3)
                            disableShield(target)
                            continue;
                        }
                    }
                }
            }
        }
    }
});

//vindicators
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:detect_vindicators' && entity.typeId == "dungeons:obsidian_monstrosity") {
        const dim = entity.dimension;
        const loc = entity.location;
        if (!dim.isChunkLoaded(loc)) return;
        if (dim.getEntities({ location: loc, maxDistance: 64, tags: ["dungeons:obsidian_monstrosity_minion"], excludeTags: ["dungeons:love_medallion_active"] }).length <= 0) {
            entity.setProperty("dungeons:can_summon_vindicators", false)
        } else {
            entity.setProperty("dungeons:can_summon_vindicators", true)
        }
    }
});

//minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:obsidian_vindicator_spawn") {
        var loc = entity.location;
        const dim = entity.dimension;

        dim.spawnParticle("dungeons:guardian_spawn", loc)
        dim.spawnParticle('dungeons:instant_teleport', { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.playSound("mob.endermen.portal", loc, { pitch: 0.65 })
        spawned("minecraft:vindicator", loc, dim)
        entity.remove()
    }
});

function spawned(id, loc, dim) {
    const entity = dim.spawnEntity(id, loc, { spawnEvent: "dungeons:spawn_obsidian_gear" })
    entity.addTag("dungeons:obsidian_monstrosity_minion")
}

system.runInterval(() => {
    for (const dimId of DimensionTypes.getAll()) {
        for (const mob of world.getDimension(dimId.typeId).getEntities({ tags: ["dungeons:obsidian_monstrosity_minion"] })) {

            var loc = mob.location;
            const dim = mob.dimension;
            const necromancerNearby = dim.getEntities({ location: loc, maxDistance: 64, type: "dungeons:obsidian_monstrosity" })
            if (necromancerNearby.length == 0) {
                dim.spawnParticle("dungeons:guardian_spawn", loc)
                dim.spawnParticle('dungeons:instant_teleport', { x: loc.x, y: loc.y + 1, z: loc.z })
                dim.playSound("mob.endermen.portal", loc, { pitch: 0.65 })
                mob.remove()
            }
        }
    }
})