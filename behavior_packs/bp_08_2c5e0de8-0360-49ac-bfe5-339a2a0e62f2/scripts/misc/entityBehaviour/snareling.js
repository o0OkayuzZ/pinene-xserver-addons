import {
    world,
    system,
    DimensionTypes,
    InputPermissionCategory
} from "@minecraft/server";

// Snareling Web
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (hurt.matches({families:["snareling"]})) return;
    if (hurt.matches({ families: ["boss"] })) return;
    var attacker = e.damageSource.damagingEntity;
    const projectile = e.damageSource.damagingProjectile;
    if(!projectile) return;
    if (!attacker || !attacker.isValid) attacker = projectile.getComponent("projectile").owner;
    if(hurt.typeId == "dungeons:the_swarm_minion") {
        e.cancel = true;
        return;
    }
    if ((attacker.matches({families: ["snareling"]}) || attacker.typeId == "dungeons:snareling_ammo") && projectile.typeId === "dungeons:snareling_ammo") {
        system.run(() => {
            if(hurt.hasTag("dungeons:stunned_effect")) return;
            var cd = world.scoreboard.getObjective('dungeons:snareling_trap_t');
            if (!cd) {
                cd = world.scoreboard.addObjective('dungeons:snareling_trap_t');
            }

            if (hurt.typeId == "minecraft:player") {
                const perms = hurt.inputPermissions;
                if (perms.isPermissionCategoryEnabled(InputPermissionCategory.LateralMovement) == false && perms.isPermissionCategoryEnabled(InputPermissionCategory.Jump) == false && perms.isPermissionCategoryEnabled(InputPermissionCategory.Mount) == false) return;
            }
            cd.setScore(hurt, 80)
            hurt.addTag("dungeons:snareling_trapped")
            hurt.dimension.playSound("mob.snareling.impact", hurt.location)
        })

    }
});
//cooldown
system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ tags: ["dungeons:snareling_trapped"] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:snareling_trap_t');
            if (!timeLeft) {
                world.scoreboard.addObjective("dungeons:snareling_trap_t")
                return;
            }
            if (!entity.scoreboardIdentity) continue;
            if (!timeLeft.hasParticipant(entity.scoreboardIdentity)) continue;
            let duration = timeLeft.getScore(entity);
            if (duration % 20 == 0 && duration > 0) {
                entity.dimension.spawnParticle("dungeons:snareling_trap_slime", entity.location)
            }
            if (duration > 0) {
                timeLeft.addScore(entity, -1);
                if (entity.typeId == "minecraft:player") {
                    const perms = entity.inputPermissions;
                    perms.setPermissionCategory(InputPermissionCategory.LateralMovement, false)
                    perms.setPermissionCategory(InputPermissionCategory.Mount, false)
                    perms.setPermissionCategory(InputPermissionCategory.Jump, false)
                } else {
                    entity.addEffect("slowness", 5, { amplifier: 255, showParticles: false })
                }
            }
            if (entity.hasTag("dungeons:stunned_effect") || duration <= 0 || (entity.typeId == "minecraft:player" && entity.getGameMode() == "Spectator")) {
                timeLeft.removeParticipant(entity)
                entity.removeTag("dungeons:snareling_trapped")
                if (entity.typeId == "minecraft:player") {
                    const perms = entity.inputPermissions;
                    perms.setPermissionCategory(InputPermissionCategory.LateralMovement, true)
                    perms.setPermissionCategory(InputPermissionCategory.Mount, true)
                    perms.setPermissionCategory(InputPermissionCategory.Jump, true)
                }
            }
        }
    }
})

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    if (hurt.hasTag("dungeons:snareling_trapped")) hurt.clearVelocity()
})

world.afterEvents.entityDie.subscribe((e) => {
    const dead = e.deadEntity;
    if (!dead || !dead.isValid) return;
    if (dead.hasTag("dungeons:snareling_trapped") && dead.typeId == "minecraft:player") {
        var cd = world.scoreboard.getObjective('dungeons:snareling_trap_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:snareling_trap_t');
        }
        cd.setScore(dead, 1)
    }
})

//teleport to target

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:teleport_near_target' && entity.matches({families: ["snareling"]})) {
        if (entity.hasTag("dungeons:snareling_teleport_used")) return;
        entity.addTag("dungeons:snareling_teleport_used")
        system.runTimeout(() => {
            if (entity.isValid) entity.removeTag("dungeons:snareling_teleport_used")
        }, 100)
        const loc = entity.location;
        const dim = entity.dimension;
        entity.addEffect("invisibility", 10, { showParticles: false })
        system.runTimeout(() => {
            var player = dim.getEntities({ closest: 1, maxDistance: 32, location: loc, tags: ["dungeons:snareling_trapped"] })
            if (player.length == 0) return;
            player = player[0]
            var xOffset = Math.random() * 5 - 2.5
            var zOffset = Math.random() * 5 - 2.5
            if (xOffset < 0 && xOffset > -1) xOffset = -1
            if (xOffset >= 0 && xOffset < 1) xOffset = 1
            if (zOffset < 0 && zOffset > -1) zOffset = -1
            if (zOffset >= 0 && zOffset < 1) zOffset = 1
            const teleportLoc = { x: player.location.x + xOffset, y: player.location.y, z: player.location.z + zOffset }
            var teleported = entity.tryTeleport(teleportLoc, { checkForBlocks: true, facingLocation: player.location })
            if (teleported) dim.playSound("mob.snareling.teleport", teleportLoc)
        }, 10)
    }
});