import {
    world,
    MolangVariableMap,
    system
} from "@minecraft/server";

import { isWearingSet, isWearingMysteryArmour } from "components/armour.js"

world.afterEvents.entityHealthChanged.subscribe((event) => {
    const player = event.entity;
    const oldValue = event.oldValue;
    var newValue = event.newValue;
    if (!player) return;
    if (!player.isValid) return;
    if (player.typeId !== "minecraft:player") return;
    if (!isWearingSet(player, "dungeons:health_share") && !isWearingMysteryArmour(player, "health_share")) return;
    if (newValue <= oldValue) {
        return;
    }
    const hp = player.getComponent("health")
    if (newValue > hp.effectiveMax) newValue = hp.effectiveMax
    const diff = newValue - oldValue
    if (diff <= 0) return;
    var targets = []
    const dim = player.dimension
    const loc = player.location
    const pets = dim.getEntities({ families: ["artefact", "pet"], maxDistance: 16, location:loc })
    for (const pet of pets) {
        const tameable = pet.getComponent("tameable")
        if (!tameable) continue;
        const owner = tameable.tamedToPlayer
        if (!owner || owner !== player) continue;
        targets.push(pet)
    }
    if(world.gameRules.pvp == false) {
        for(const extraPlayer of dim.getPlayers({excludeGameModes:["Spectator","Creative"], maxDistance: 16, location: loc})) {
            const exHp = extraPlayer.getComponent("health")
            if(exHp && exHp.currentValue < hp.effectiveMax) targets.push(extraPlayer)
        }
    }
    if(targets.length < 1) return;
    for(const target of targets) {
        const target_hp = target.getComponent("health")
        var setTo = target_hp.currentValue + diff
        if(setTo > target_hp.effectiveMax) setTo = target_hp.effectiveMax
        if(target_hp.currentValue == setTo) continue;
        target_hp.setCurrentValue(setTo)
        for(let i = 0; i < 3; i++) {
            system.runTimeout(() => {
                particle(player,target)
            },i)
        }
    }
});

const particleSpeed = 14

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
        map.setColorRGB("variable.color", { red: 0.75, green: 0.75, blue: 0 })
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