import {
    world,
    system,
    EntityDamageCause,
    DimensionTypes,
    MolangVariableMap
} from "@minecraft/server";

const teleportHiddenTime = 10

//projectiles
function multiply(a, b) {
    return { x: a.x * b.x, y: a.y * b.y, z: a.z * b.z };
}
world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    const cause = e.cause;
    if (cause !== "Spawned") return;
    if (entity.typeId == "dungeons:arch_illager_projectile" && !entity.hasTag("dungeons:chud_projectile")) {

        const proj = entity.getComponent("projectile")
        if (!proj) return;
        const owner = proj.owner;
        if (!owner) return;
        if (owner.typeId == "dungeons:arch_illager") {
            owner.playAnimation("animation.arch_illager.shoot")
            const dim = owner.dimension;
            const viewDir = owner.getViewDirection()
            let amount = 3
            for (let i = 0; i < amount; i++) {
                const angle = -((amount - 1) / 2 * 10) + 10 * i;
                const radians = angle * (Math.PI / 180)
                if (angle == 0) continue;
                const hd = owner.getHeadLocation();
                const vd = owner.getViewDirection();
                const projectile = dim.spawnEntity(entity.typeId, { x: hd.x + vd.x, y: hd.y + vd.y, z: vd.z + hd.z })
                const comp = projectile.getComponent('projectile');
                let cosTheta = Math.cos(radians);
                let sinTheta = Math.sin(radians);
                const direction = {
                    x: viewDir.x * cosTheta + viewDir.z * sinTheta,
                    y: viewDir.y,
                    z: -viewDir.x * sinTheta + viewDir.z * cosTheta
                }
                if (comp) {
                    comp.owner = owner
                    comp.shoot(multiply(direction, { x: 0.53, y: 0.63, z: 0.53 }))
                } else {
                    projectile.applyImpulse(multiply(direction, { x: 0.53, y: 0.53, z: 0.53 }))
                }
                projectile.addTag("dungeons:chud_projectile")
            }

        } else {
            return;
        }
    }
})

world.afterEvents.projectileHitBlock.subscribe((e) => {
    const entity = e.projectile;
    if (entity.typeId == "dungeons:arch_illager_projectile") {
        entity.remove()
    }
})
world.afterEvents.projectileHitEntity.subscribe((e) => {
    const entity = e.projectile;
    const hit = e.getEntityHit().entity
    if (!hit.isValid) return;
    if (entity.typeId == "dungeons:arch_illager_projectile") {
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
        if (hit.matches({ families: ["illager"] })) return;
        hit.applyDamage(8.5, { damagingEntity: owner, cause: EntityDamageCause.magic })
        hit.dimension.playSound("mob.arch_illager.magic_hit", hit.location)
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
    if (projectile.typeId !== "dungeons:arch_illager_projectile") return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (hit.matches({ families: ["illager"] }) || hit.matches({ families: ["monster"] })) {
        e.cancel = true;
        e.damage = 0
    }
});

//locations

const posIds = [
    "center",
    "posx",
    "negx",
    "posz",
    "negz"
]

function getNewPosLocation(entity) {
    const current = entity.getProperty("dungeons:current_point")
    var options = []
    for (const id of posIds) {
        if (current !== id) options.push(id)
    }
    const chosen = options[Math.floor(Math.random() * options.length)]
    const loc = entity.getDynamicProperty("dungeons:" + chosen)
    entity.setProperty("dungeons:current_point", chosen)
    return loc
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (entity.typeId !== "dungeons:arch_illager") return;
    const loc = entity.location
    entity.setDynamicProperty("dungeons:center", { x: loc.x, y: loc.y + 4, z: loc.z });
    entity.setDynamicProperty("dungeons:posx", { x: loc.x + 10, y: loc.y + 3, z: loc.z });
    entity.setDynamicProperty("dungeons:negx", { x: loc.x - 10, y: loc.y + 3, z: loc.z });
    entity.setDynamicProperty("dungeons:posz", { x: loc.x, y: loc.y + 3, z: loc.z + 10 });
    entity.setDynamicProperty("dungeons:negz", { x: loc.x, y: loc.y + 3, z: loc.z - 10 });
    entity.addEffect("slowness", 999999, { amplifier: 255, showParticles: false })

    const cause = e.cause;
    if (cause == "Transformed") {
        entity.addEffect("invisibility", 1, { showParticles: false })
        const loc = getNewPosLocation(entity)
        teleport(entity, loc)
    }
})

//teleport
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:arch_illager_change_position' && entity.typeId == "dungeons:arch_illager") {
        const loc = getNewPosLocation(entity)
        teleport(entity, loc)
    }
})

function teleport(entity, teleportLoc) {
    const entityLoc = entity.location;
    const dim = entity.dimension;

    dim.runCommand(`fill ${teleportLoc.x + 1} ${teleportLoc.y + 3} ${teleportLoc.z + 1} ${teleportLoc.x - 1} ${teleportLoc.y} ${teleportLoc.z} air destroy`)
    var tpWorked = entity.tryTeleport(teleportLoc)
    if (!tpWorked) return;
    entity.setProperty("dungeons:teleporting", true)
    dim.playSound("mob.arch_illager.magic_hit", entityLoc)
    dim.spawnParticle("dungeons:teleport_out", entityLoc)
    dim.spawnParticle("dungeons:enchanted_tome", entityLoc)
    system.runTimeout(() => {
        if (dim.isChunkLoaded(teleportLoc)) {
            dim.playSound("mob.arch_illager.magic_hit", entityLoc, { pitch: 0.7 })
            dim.spawnParticle("dungeons:teleport_in", teleportLoc)
            dim.spawnParticle("dungeons:enchanted_tome", teleportLoc)
        }

        if (entity.isValid) {
            entity.playAnimation("animation.arch_illager.wave_staff")
            entity.setProperty("dungeons:teleporting", false)
        }
    }, teleportHiddenTime)
    entity.addEffect("invisibility", teleportHiddenTime, { showParticles: false })
    connectLine(entity, entityLoc, dim)
}
function connectLine(player, baseLoc, baseDim) {
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < teleportHiddenTime; i += teleportHiddenTime / baseDist) {
        system.runTimeout(() => {
            if (player.dimension !== baseDim) return;
            const targetLoc = player.location;
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            const particleLoc = { x: baseLoc.x + (xDif * (i / teleportHiddenTime)), y: 1 + baseLoc.y + (yDif * (i / teleportHiddenTime)), z: baseLoc.z + (zDif * (i / teleportHiddenTime)) }
            if (player.dimension.isChunkLoaded(particleLoc)) {
                player.dimension.spawnParticle("dungeons:voided_stars", particleLoc)
                player.dimension.spawnParticle("dungeons:teleport_beam", particleLoc)
            }
        }, i)
    }
}


//summon minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:evaluate_minions' && entity.typeId == "dungeons:arch_illager") {
        const loc = entity.location
        const dim = entity.dimension
        const canEnchant = entity.getProperty("dungeons:can_enchant")
        const canSummon = entity.getProperty("dungeons:can_summon")
        const minions = dim.getEntities({ maxDistance: 32, location: loc, excludeFamilies: ["enchanted"], tags: ["dungeons:arch_illager_minion"] })
        const enchantedMinions = dim.getEntities({ maxDistance: 32, location: loc, families: ["enchanted"], tags: ["dungeons:arch_illager_minion"] })
        if (canSummon && minions.length + enchantedMinions.length >= 4) entity.setProperty("dungeons:can_summon", false)
        if (!canSummon && minions.length + enchantedMinions.length < 4) entity.setProperty("dungeons:can_summon", true)

        if (!canEnchant && minions.length > 0 && enchantedMinions.length == 0) entity.setProperty("dungeons:can_enchant", true)
        if (canEnchant && enchantedMinions.length > minions.length || minions.length == 0) entity.setProperty("dungeons:can_enchant", false)
    }
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:arch_illager_minion_spawnpoint") {
        var loc = entity.location;
        const dim = entity.dimension;
        const vindicators = dim.getEntities({ maxDistance: 32, location: loc, type: "minecraft:vindicator", tags: ["dungeons:arch_illager_minion"] }).length
        const pillagers = dim.getEntities({ maxDistance: 32, location: loc, type: "minecraft:pillager", tags: ["dungeons:arch_illager_minion"] }).length
        if (Math.random() > 0.5) {
            if (vindicators <= 3) {
                if (pillagers <= 3) spawned("minecraft:pillager", loc, dim)
            } else {

                spawned("minecraft:vindicator", loc, dim)
            }
        } else {
            if (pillagers <= 3) {
                if (vindicators <= 3) spawned("minecraft:vindicator", loc, dim)
            } else {

                spawned("minecraft:pillager", loc, dim)
            }

        }
        entity.remove()
    }
});

function spawned(id, loc, dim) {
    dim.spawnParticle("dungeons:guardian_spawn", loc)
    dim.spawnParticle('dungeons:instant_teleport', { x: loc.x, y: loc.y + 1, z: loc.z })
    dim.playSound("mob.endermen.portal", loc, { pitch: 0.65 })
    const entity = dim.spawnEntity(id, loc, { spawnEvent: "dungeons:spawn_arch_illager_gear" })
    entity.addTag("dungeons:arch_illager_minion")
}

system.runInterval(() => {
    for (const dimId of DimensionTypes.getAll()) {
        for (const mob of world.getDimension(dimId.typeId).getEntities({ tags: ["dungeons:arch_illager_minion"] })) {

            var loc = mob.location;
            const dim = mob.dimension;
            const necromancerNearby = dim.getEntities({ location: loc, maxDistance: 64, type: "dungeons:arch_illager" })
            if (necromancerNearby.length == 0) {
                dim.spawnParticle("dungeons:guardian_spawn", loc)
                dim.spawnParticle('dungeons:instant_teleport', { x: loc.x, y: loc.y + 1, z: loc.z })
                dim.playSound("mob.endermen.portal", loc, { pitch: 0.65 })
                mob.remove()
            }
        }
    }
})

//enchant minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'minecraft:entity_spawned' && entity.typeId == "dungeons:arch_illager_enchant_nearby_mobs") {
        var loc = entity.location;
        const dim = entity.dimension;
        entity.remove()
        const archIllager = dim.getEntities({ maxDistance: 322, location: loc, type: "dungeons:arch_illager", closest: 1 })
        if (archIllager.length == 0) return
        archIllagerEnchant(archIllager[0], dim)
    }
});
const particleSpeed = 10

function archIllagerEnchant(entity, dim) {
    const enchants = 2
    const targets = dim.getEntities({ location: entity.location, maxDistance: 32, excludeFamilies: ["enchanted"], tags: ["dungeons:arch_illager_minion"], closest: enchants })
    for (const target of targets) {

        dim.spawnParticle("dungeons:guardian_spawn", target.location)
        target.addTag("dungeons:being_enchanted")
        system.runTimeout(() => {
            dim.playSound("mob.enchanter.beam_on", entity.location)
            dim.playSound("mob.enchanter.cast", entity.location)
            for (let i = 0; i < 40; i++) {
                system.runTimeout(() => {
                    if (!target.isValid || !entity.isValid) return;
                    var eLoc = entity.location;
                    const viewDirection = entity.getViewDirection()
                    eLoc = { x: eLoc.x + viewDirection.x, y: eLoc.y + 1.5, z: eLoc.z + viewDirection.z }
                    if (dim.isChunkLoaded(eLoc)) {
                        var tLoc = target.location;
                        tLoc = { x: tLoc.x, y: tLoc.y + 1, z: tLoc.z }
                        var dx = tLoc.x - eLoc.x
                        var dy = tLoc.y - eLoc.y
                        var dz = tLoc.z - eLoc.z
                        const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

                        dx = dx / length
                        dy = dy / length
                        dz = dz / length

                        const lifetime = length / particleSpeed

                        var map = new MolangVariableMap()
                        map.setColorRGB("variable.color", { red: 1, green: 0, blue: 1 })
                        map.setFloat("variable.particle_initial_speed", particleSpeed)
                        map.setFloat("variable.max_lifetime", lifetime)
                        map.setVector3("variable.direction", { x: dx, y: dy, z: dz })

                        var xOffset = Math.random() * 0.4 - 0.2
                        var yOffset = Math.random() * 0.4 - 0.2
                        var zOffset = Math.random() * 0.4 - 0.2
                        dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
                    }
                }, i / 2)
                system.runTimeout(() => {
                    if (!target.isValid || !entity.isValid) return;
                    if (target.hasTag("dungeons:being_enchanted")) {
                        target.removeTag("dungeons:being_enchanted")
                        dim.spawnParticle("dungeons:enchanted_tome", target.location)
                        dim.playSound("mob.enchanter.enchant", target.location)
                        target.triggerEvent("dungeons:become_enchanted_arch_illager")
                    }
                    target.removeTag("dungeons:being_enchanted")
                }, 20)
            }
        })
    }
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id == "dungeons:arch_illager" && entity.matches({ families: ["enchanted"] })) {
        entity.addTag("dungeons:arch_illager_minion")
    }
})


//death behaviour
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id == "dungeons:arch_illager_dead") {
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (hurt.typeId !== "dungeons:arch_illager") return;
    if (hurt.hasTag("dungeons:arch_illager_immune")) {
        if (e.damageSource.cause !== "selfDestruct") return e.cancel = true;
        return;
    }
    const health = hurt.getComponent("minecraft:health")
    if (health.currentValue <= 40) {
        e.cancel = true;
        system.run(() => {
            hurt.addTag("dungeons:arch_illager_immune")
            health.setCurrentValue(1)
            const dim = hurt.dimension
            dim.playSound("mob.arch_illager.hurt", hurt.location, { pitch: 0.7 })
            dim.playSound("mob.vindicator.death", hurt.location, { pitch: 0.7 })
            var loc = hurt.getDynamicProperty("dungeons:center")
            loc = dim.getBlock({ x: loc.x, y: loc.y - 4, z: loc.z }).bottomCenter()
            teleport(hurt, loc)
            system.runTimeout(() => {
                hurt.remove()
                deathCutscene(dim, loc)
            }, teleportHiddenTime - 1)
        })
    }
})

function deathCutscene(dim, loc) {
    const body = dim.spawnEntity("dungeons:arch_illager_death_animation", loc)
    system.runTimeout(() => {
        dim.spawnEntity("dungeons:heart_of_ender_resting", loc, { spawnEvent: "dungeons:start_waking" })
        system.runTimeout(() => {
            body.remove()
        }, 2)
    }, 210)
}