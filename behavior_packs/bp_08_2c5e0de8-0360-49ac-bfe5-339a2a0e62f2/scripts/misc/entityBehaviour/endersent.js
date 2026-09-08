import {
    world,
    system,
    EntityDamageCause,
    BlockVolume
} from "@minecraft/server";

const teleportHiddenTime = 12
const targetTeleportHiddenTime = 30
import { isValidTarget, getDirection, makeVector } from "main.js"

function isEndersent(mob) {
    if (!mob.isValid) return false;
    if (mob.matches({ families: ["endersent"] })) return true;
    return false;
}

function spawnWatchling(origin, dim) {
    const entities = dim.getEntities({ families: ["endersent_minion"], location: origin, maxDistance: 32 })
    if (entities.length >= 3) return;
    var xMod = (Math.random() * 3) - 1.5
    var zMod = (Math.random() * 3) - 1.5
    if (xMod < 0 && xMod > -1) xMod = -1
    if (xMod > 0 && xMod < 1) xMod = 1
    if (zMod < 0 && zMod > -1) zMod = -1
    if (zMod > 0 && zMod < 1) zMod = 1
    var spawnloc = { x: origin.x + xMod, y: origin.y, z: origin.z + zMod }
    dim.spawnEntity("dungeons:watchling", origin, { spawnEvent: "dungeons:spawn_endersent_minion" }).tryTeleport(spawnloc)
}

//teleport
function teleport(entity, loc, boom) {
    entity.triggerEvent("dungeons:bossbar_invulnerable")
    if (loc == undefined) loc = entity.location;
    if (boom == undefined) boom = false
    const entityLoc = entity.location;
    const dim = entity.dimension;
    var validTeleport = false
    var teleportAttempts = 20
    var time = teleportHiddenTime
    if (boom) time = targetTeleportHiddenTime
    for (let i = 0; i < teleportAttempts && validTeleport == false; i++) {
        if (boom == false) {
            var xMod = (Math.random() * 22) - 11
            var zMod = (Math.random() * 22) - 11
            if (xMod < 0 && xMod > -3) xMod = -3
            if (xMod > 0 && xMod < 3) xMod = 3
            if (zMod < 0 && zMod > -3) zMod = -3
            if (zMod > 0 && zMod < 3) zMod = 3
        } else {

            var xMod = (Math.random() * 3) - 1.5
            var zMod = (Math.random() * 3) - 1.5
            if (xMod < 0 && xMod > -1) xMod = -1
            if (xMod > 0 && xMod < 1) xMod = 1
            if (zMod < 0 && zMod > -1) zMod = -1
            if (zMod > 0 && zMod < 1) zMod = 1
        }
        var teleportLoc = { x: loc.x + xMod, y: loc.y, z: loc.z + zMod }
        teleportLoc.y = dim.getTopmostBlock({ x: teleportLoc.x, z: teleportLoc.z }, teleportLoc.y).y + 1
        if (teleportLoc.y < loc.y - 0.5 || teleportLoc.y > loc.y + 1) continue;

        const baseDist = Math.hypot(teleportLoc.x - loc.x, teleportLoc.y - loc.y, teleportLoc.z - loc.z)
        const xDif = loc.x - teleportLoc.x
        const yDif = loc.y - teleportLoc.y
        const zDif = loc.z - teleportLoc.z
        var isWalled = false;
        for (let i = 1; i < baseDist; i++) {
            const checkBlock = dim.getBlock({ x: teleportLoc.x + (xDif * (i / baseDist)), y: 1 + teleportLoc.y + (yDif * (i / baseDist)), z: teleportLoc.z + (zDif * (i / baseDist)) })
            if (!checkBlock) break;
            if (checkBlock.isAir == false) {
                isWalled = true;
            }
        }
        if (isWalled) continue;
        if (!dim.getBlock(teleportLoc)) continue;
        if (dim.getBlock(teleportLoc).above().isAir == false || dim.getBlock(teleportLoc).above().above().isAir == false) continue;
        if (teleportLoc) validTeleport = true
    }
    if (!teleportLoc && boom == true) {
        teleportLoc = loc
        validTeleport = true
    }
    if (!validTeleport) return entity.triggerEvent("dungeons:bossbar_normal");
    if (boom) {
        spawnWatchling(entityLoc, dim)
        spawnWatchling(entityLoc, dim)
    }
    entity.tryTeleport(teleportLoc)
    dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 0.6 })
    system.runTimeout(() => {
        if (dim.isChunkLoaded(loc)) {
            dim.playSound("mob.wraith.teleport", entityLoc, { pitch: 0.9 })
        }
        entity.triggerEvent("dungeons:bossbar_normal")
        if (boom) createExplosion(dim, { x: teleportLoc.x, y: teleportLoc.y + 1, z: teleportLoc.z }, entity)
    }, time)
    entity.addEffect("invisibility", time, { showParticles: false })
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
                player.dimension.spawnParticle("dungeons:endersent_teleport_beam", particleLoc)
                player.dimension.spawnParticle("dungeons:voided_stars", particleLoc)
            }
        }, i)
    }
}
function createExplosion(dim, loc, entity) {
    entity.playAnimation("animation.endersent_v2.roar")
    system.runTimeout(() => {
        const damageRange = dim.getEntities({
            location: loc,
            maxDistance: 3.5,
            excludeFamilies: ['ignore', "enderling", "endermite", "enderman"]
        });
        for (const target of damageRange) {
            if (isValidTarget(target) == false) continue;
            if (target === entity) continue;
            const damageDone = target.applyDamage(25, { damagingEntity: entity, cause: "entityExplosion" })
            if (!damageDone) continue;
            const dir = getDirection(loc, target.location);
            target.applyKnockback(makeVector(dir, 0.65), 0.33)
        }
        dim.spawnParticle("dungeons:endersent_teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
        dim.spawnParticle("dungeons:endersent_teleport_boom_dust", loc)
        dim.playSound("random.explode", loc, { pitch: 0.7 })
        dim.playSound("armour.teleport.explode", loc)
    }, 1)
}

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id === 'dungeons:try_teleport_random' && isEndersent(entity)) {
        if (Math.random() > 0.2) return;
        const nearbyPlayer = entity.dimension.getPlayers({ location: entity.location, closest: 1, maxDistance: 64 })
        var loc = entity.location;
        if (nearbyPlayer.length >= 1 && Math.random() > 0.5) loc = nearbyPlayer[0].location
        teleport(entity, loc)
    } else if (id === 'dungeons:attempt_target_teleport' && isEndersent(entity)) {
        entity.addEffect("slowness", 60, { amplifier: 99, showParticles: false })
        entity.addEffect("weakness", 60, { amplifier: 99, showParticles: false })
        system.runTimeout(() => {
            const nearbyPlayer = entity.dimension.getPlayers({ location: entity.location, closest: 1, maxDistance: 64 })
            var loc = entity.location;
            if (nearbyPlayer.length >= 1) loc = nearbyPlayer[0].location
            teleport(entity, loc, true)
            entity.setProperty("dungeons:target_teleporting", false)
        }, 20)
    }
});
world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (!isEndersent(attacker)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;

    if (e.damage <= 0) {
        e.cancel = true;
        e.damage = 0
    }

});

//minions

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (!entity) return;
    if (!entity.isValid) return;
    if (id == "dungeons:despawn_endersent_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:teleport_out", loc)
        dim.playSound("mob.wraith.teleport", loc, { pitch: 1 })
        entity.remove()

    } else if (id == "dungeons:spawn_endersent_minion") {
        const dim = entity.dimension;
        const loc = entity.location;
        dim.spawnParticle("dungeons:teleport_in", loc)
        dim.spawnParticle("dungeons:guardian_spawn", loc)
        dim.playSound("mob.wraith.teleport", loc, { pitch: 1.5 })
    }
});
