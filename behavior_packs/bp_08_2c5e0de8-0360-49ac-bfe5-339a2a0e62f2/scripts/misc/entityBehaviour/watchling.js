import {
    world,
    system
} from "@minecraft/server";

//teleport

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:try_teleport' && entity.typeId.includes("watchling")) {
        if (Math.random() > 0.25) return;
        const health = entity.getComponent("health")
        if (health.currentValue <= 0) return;
        system.runTimeout(() => {
            teleport(entity)
        }, 5)
    }
})

const teleportHiddenTime = 33

function teleport(entity, loc) {
    entity.addTag("dungeons:watchling_teleporting")
    if (loc == undefined) loc = entity.location;
    const entityLoc = entity.location;
    const dim = entity.dimension;
    var validTeleport = false
    var teleportAttempts = 20
    for (let i = 0; i < teleportAttempts && validTeleport == false; i++) {
        var xMod = (Math.random() * 12) - 6
        var zMod = (Math.random() * 12) - 6
        if (xMod < 0 && xMod > -3) xMod = -3
        if (xMod > 0 && xMod < 3) xMod = 3
        if (zMod < 0 && zMod > -3) zMod = -3
        if (zMod > 0 && zMod < 3) zMod = 3
        var teleportLoc = { x: loc.x + xMod, y: loc.y, z: loc.z + zMod }
        teleportLoc.y = dim.getTopmostBlock({ x: teleportLoc.x, z: teleportLoc.z }, teleportLoc.y).y + 1
        if (teleportLoc.y < loc.y - 3 || teleportLoc.y > loc.y + 1) continue;

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
    if (validTeleport == false) return;
    entity.tryTeleport(teleportLoc)
    dim.playSound("mob.endermen.portal", entityLoc, { pitch: 0.6 })
    dim.spawnParticle("dungeons:teleport_out", entityLoc)
    dim.spawnParticle("dungeons:instant_teleport", { x: entityLoc.x, y: entityLoc.y + 1, z: entityLoc.z })
    system.runTimeout(() => {
        if (!entity.isValid) return;
        entity.removeTag("dungeons:watchling_teleporting")
        if (dim.isChunkLoaded(loc)) {
            dim.playSound("mob.endermen.portal", entityLoc, { pitch: 1 })
            dim.spawnParticle("dungeons:teleport_in", { x: teleportLoc.x, y: teleportLoc.y + 1, z: teleportLoc.z })
        }
    }, teleportHiddenTime)
    entity.addEffect("invisibility", teleportHiddenTime, { showParticles: false })
    entity.addEffect("resistance", teleportHiddenTime, { amplifier: 4, showParticles: false })
    connectLine(entity, entityLoc, dim)
}
function connectLine(player, baseLoc, baseDim) {
    if (!player.isValid) return;
    const baseDist = Math.hypot(baseLoc.x - player.location.x, baseLoc.y - player.location.y, baseLoc.z - player.location.z)
    for (let i = 1; i < teleportHiddenTime; i += teleportHiddenTime / baseDist) {
        system.runTimeout(() => {
            if (!player.isValid) return;
            if (player.dimension !== baseDim) return;
            const targetLoc = player.location;
            const xDif = targetLoc.x - baseLoc.x
            const yDif = targetLoc.y - baseLoc.y
            const zDif = targetLoc.z - baseLoc.z
            const particleLoc = { x: baseLoc.x + (xDif * (i / teleportHiddenTime)), y: 1 + baseLoc.y + (yDif * (i / teleportHiddenTime)), z: baseLoc.z + (zDif * (i / teleportHiddenTime)) }
            if (player.dimension.isChunkLoaded(particleLoc)) {
                player.dimension.spawnParticle("dungeons:teleport_beam", particleLoc)
            }
        }, i)
    }
}