import {
    world,
    system,
    EntityDamageCause,
    MolangVariableMap
} from "@minecraft/server";

const particleSpeed = 15
import { isWearingSet } from "components/armour.js"
import { isValidTarget, specialDamage } from "main.js"


system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:frost_bite")) {
            const nearbyMobs = player.dimension.getEntities(
                {
                    location: player.location,
                    maxDistance: 8,
                    excludeFamilies: ["ignore"]
                });
            if (nearbyMobs.length == 0) return;
            for (const mob of nearbyMobs) {
                if (mob == player) continue;
                if (isValidTarget(mob) == false) continue;
                if (!mob.matches({ families: ["monster"] }) && !mob.matches({ families: ["player"] })) continue
                const timeout = particle(player, mob)
                system.runTimeout(() => {
                    const isOnFire = mob.getComponent("onfire")
                    if (isOnFire) {
                        mob.extinguishFire()
                    } else {
                        const dim = mob.dimension
                        const loc = player.location
                        const targetLoc = mob.getHeadLocation()
                        const health = mob.getComponent("health")
                        if (health && health.currentValue > 1) {

                            const dmg = specialDamage(player, mob, 0.5, EntityDamageCause.freezing, ["ice"])
                            if (!dmg) return;
                            dim.playSound("mob.player.hurt_freeze", loc, { pitch: 2.25 })
                        }
                        dim.spawnParticle("minecraft:ice_evaporation_emitter", targetLoc)
                        mob.addEffect("slowness", 35, { amplifier: 3, showParticles: false })
                        mob.clearVelocity()
                        dim.playSound("step.powder_snow", loc, { pitch: 1.25 })
                    }
                }, timeout)
                return;
            }
        }
    }
}, 50);

function particle(player, mob) {
    const dim = player.dimension
    var eLoc = player.location;
    eLoc = { x: eLoc.x, y: eLoc.y + 1, z: eLoc.z }
    if (dim.isChunkLoaded(eLoc)) {
        var tLoc = mob.location;
        tLoc = { x: tLoc.x, y: tLoc.y + (mob.getHeadLocation().y - tLoc.y) / 2, z: tLoc.z }
        var dx = tLoc.x - eLoc.x
        var dy = tLoc.y - eLoc.y
        var dz = tLoc.z - eLoc.z
        const length = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2) + Math.pow(dz, 2))

        dx = dx / length
        dy = dy / length
        dz = dz / length

        const lifetime = length / particleSpeed

        var map = new MolangVariableMap()
        map.setColorRGB("variable.color", { red: 0.75, green: 0.75, blue: 1 })
        map.setFloat("variable.particle_initial_speed", particleSpeed)
        map.setFloat("variable.max_lifetime", lifetime)
        map.setVector3("variable.direction", { x: dx, y: dy, z: dz })

        var xOffset = Math.random() * 0.4 - 0.2
        var yOffset = Math.random() * 0.4 - 0.2
        var zOffset = Math.random() * 0.4 - 0.2
        dim.spawnParticle("minecraft:creaking_heart_trail", { x: eLoc.x + xOffset, y: eLoc.y + yOffset, z: eLoc.z + zOffset }, map)
        return lifetime * 20
    }
    return 1
}