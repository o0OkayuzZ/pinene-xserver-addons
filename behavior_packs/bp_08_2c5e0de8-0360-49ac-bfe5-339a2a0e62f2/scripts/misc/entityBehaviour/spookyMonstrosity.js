import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, getDirection, makeVector } from "main.js"

function crack(loc, dim) {
    dim.spawnParticle("dungeons:spooky_cracks", { x: loc.x, y: loc.y + 1, z: loc.z })
    dim.playSound("mob.ghast.fireball", loc, { pitch: 0.25 })
    dim.playSound("random.fuse", loc, { pitch: 1.15 })
    for (let i = 0; i < 50; i++) {
        system.runTimeout(() => {
            if (i % 5 == 0) dim.playSound("mob.ghast.fireball", loc, { pitch: 1.1 - (i / 50), volume: 0.2 })
            dim.spawnParticle("dungeons:lava_particle_soul", { x: loc.x, y: loc.y, z: loc.z })
        }, i)
    }
    system.runTimeout(() => {
        dim.spawnParticle("dungeons:spooky_eruption_1", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:spooky_eruption_2", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:spooky_eruption_3", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:spooky_forge_core_dust", { x: loc.x, y: loc.y + 1, z: loc.z })

        dim.spawnParticle("dungeons:spooky_cracks_revert", { x: loc.x, y: loc.y + 1, z: loc.z })

        dim.playSound("mob.ghast.fireball", loc, { pitch: 0.25, volume: 2 })
        dim.playSound("random.explode", loc, { pitch: 0.15, volume: 2 })
        if (Math.random() < 0.33) dim.spawnEntity("dungeons:rolling_flame", loc, { spawnEvent: "dungeons:monstrosity_minion" })
        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 5,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                var distanceBetween = Math.round(Math.hypot(loc.x - target.location.x, loc.y - target.location.y, loc.z - target.location.z)) * 3
                const damage = target.applyDamage(25 - distanceBetween, { cause: EntityDamageCause.entityExplosion });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.3 2")
                        target.runCommand("camerashake add @s 0.3 1.5")
                        target.runCommand("camerashake add @s 0.3 1")
                        target.runCommand("camerashake add @s 0.3 0.5")
                    }
                    const dir = getDirection(loc, target.location);
                    target.applyKnockback(makeVector(dir, 1.2), 0.3)
                }
            }
        }
    }, 50)
}

//make cracks
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:spooky_monstrosity_lavacrack") {
        var loc = entity.location;
        const dim = entity.dimension;
        system.runTimeout(() => {
            const block = dim.getTopmostBlock({ x: loc.x + (Math.random() * 4), z: loc.z + (Math.random() * 4) }, loc.y)
            loc = { x: block.x, y: block.y + 0.01, z: block.z }
            if (block.typeId.includes("slab")) loc = { x: block.x, y: block.y - 0.45, z: block.z }


            crack(loc, dim)
        }, Math.floor(Math.random() * 20))
        entity.remove()
    }
});



//projectiles

function projectileexplosion(loc, dim, owner, entity) {
    dim.spawnParticle('dungeons:harvester_blast', loc);
    dim.spawnParticle('dungeons:harvester_blast2', loc);
    system.runTimeout(() => {
        dim.spawnParticle('dungeons:harvester_flames', loc);
    }, 6)
    dim.playSound("random.explode", loc, { volume: 2, pitch: 1.2 })
    dim.playSound("weapon.enchant.exploding", loc, { volume: 2, pitch: 0.8 + Math.random() * 0.4 })
    const targets = dim.getEntities({ location: loc, maxDistance: 4 })
    for (const target of targets) {
        if ((isValidTarget(target) || target.matches({ families: ["player"] })) && target !== owner) {
            const damage = target.applyDamage(12, { cause: EntityDamageCause.entityExplosion, damagingEntity: owner })
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
    system.run(() => {
        entity.remove()
    })
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    const cause = e.cause;
    if (cause !== "Spawned") return;
    if (entity.typeId == "dungeons:spooky_monstrosity_projectile") {

        const proj = entity.getComponent("projectile")
        if (!proj) return;
        const owner = proj.owner;
        if (!owner) {
            entity.dimension.playSound("mob.redstone_monstrosity.shoot", entity.location)
        } else {
            owner.dimension.playSound("mob.redstone_monstrosity.shoot", owner.location)

        }
    }
})

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    const loc = e.location;
    const dim = e.dimension;
    if (entity.typeId == "dungeons:spooky_monstrosity_projectile") {
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
    if (entity.typeId == "dungeons:spooky_monstrosity_projectile") {
        const proj = entity.getComponent("minecraft:projectile")
        const owner = proj.owner;
        if (!owner) {
            entity.remove()
            return;
        }
        projectileexplosion(loc, dim, owner, entity)
    }
})

//melee effect

function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 80)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    dim.playSound("random.break", targetLoc, { pitch: 0.6 })
    dim.spawnParticle("minecraft:critical_hit_emitter", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
}
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:melee_attack_used' && entity.typeId == "dungeons:spooky_monstrosity") {
        var loc = entity.location;
        const dim = entity.dimension;
        const vd = entity.getViewDirection();
        const impactPoint = { x: loc.x + vd.x * 5, y: loc.y + 0.2, z: loc.z + vd.z * 5 }
        dim.spawnParticle("dungeons:spooky_eruption_3", impactPoint)
        const damageRange = dim.getEntities({
            location: impactPoint,
            maxDistance: 5,
            excludeFamilies: ['ignore']
        });
        for (const target of damageRange) {
            var damage = false
            if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
                if (target.matches({ families: ["monster"] })) continue;
                var distanceBetween = Math.round(Math.hypot(impactPoint.x - target.location.x, impactPoint.y - target.location.y, impactPoint.z - target.location.z)) * 2
                damage = target.applyDamage(16 - distanceBetween, { cause: EntityDamageCause.entityAttack });
                if (damage) {
                    if (target.typeId == "minecraft:player") {
                        target.runCommand("camerashake add @s 0.2 2.5")
                        target.runCommand("camerashake add @s 0.3 1.55")
                        target.runCommand("camerashake add @s 0.4 1.5")
                        target.runCommand("camerashake add @s 0.5 0.55")
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


//fire
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:particle' && entity.typeId == "dungeons:rolling_flame") {
        var loc = entity.location;
        const dim = entity.dimension;
        dim.spawnEntity("dungeons:wraith_fire", loc, { spawnEvent: "dungeons:spawn_rolling_flame_fire" })
    }
});



//halloween checker
system.afterEvents.scriptEventReceive.subscribe((event) => {
    const id = event.id;
    const entity = event.sourceEntity;
    if (id == "dungeons:check_spooky") {
        const month = new Date().getMonth();
        if (month == 9) {
            entity.triggerEvent("dungeons:start_waking_spooky")
        } else {
            entity.triggerEvent("dungeons:start_waking")
        }
    }
})