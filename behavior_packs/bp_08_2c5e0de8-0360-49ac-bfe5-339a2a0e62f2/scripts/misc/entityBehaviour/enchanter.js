import {
    world,
    system,
    MolangVariableMap
} from "@minecraft/server";

const particleSpeed = 10

//vfx
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if (id === 'dungeons:begin_casting' && entity.typeId == "dungeons:enchanter") {
        system.runTimeout(() => {
            const dim = entity.dimension;
            const loc = entity.location;
            const points = dim.getEntities({ location: loc, maxDistance: 64, closest: 1, excludeTags: ["dungeons:enchanter_detected"], type: "dungeons:enchanter_point" })
            if (points.length == 1) {
                const point = points[0]
                entity.addTag("dungeons:enchanting_detected")
                point.addTag("dungeons:enchanter_detected")
                point.addTag("dungeons:enchanter_linked_" + `${entity.id}`)
                var enchantable = dim.getEntities({ closest: 1, location: point.location, maxDistance: 8, families: ["enchantable"], excludeFamilies: ["enchanted"], excludeTags: ["dungeons:being_enchanted"] })
                if (enchantable.length == 0) {
                    return;
                };
                enchantable = enchantable[0]
                dim.spawnParticle("dungeons:guardian_spawn", enchantable.location)
                enchantable.addTag("dungeons:being_enchanted")
                system.runTimeout(() => {
                    dim.playSound("mob.enchanter.beam_on", entity.location)
                    dim.playSound("mob.enchanter.cast", entity.location)
                    for (let i = 0; i < 40; i++) {
                        system.runTimeout(() => {
                            if (!enchantable.isValid || !entity.isValid) return;
                            var eLoc = entity.location;
                            const viewDirection = entity.getViewDirection()
                            eLoc = { x: eLoc.x + viewDirection.x, y: eLoc.y + 1.5, z: eLoc.z + viewDirection.z }
                            if (dim.isChunkLoaded(eLoc)) {
                                var tLoc = enchantable.location;
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
                            if (!enchantable.isValid || !entity.isValid) return;
                            if (enchantable.hasTag("dungeons:being_enchanted")) {
                                enchantable.removeTag("dungeons:being_enchanted")
                                dim.spawnParticle("dungeons:enchanted_tome", enchantable.location)
                                dim.playSound("mob.enchanter.enchant", enchantable.location)
                                enchantable.triggerEvent(getEvent(enchantable))
                            }
                            enchantable.removeTag("dungeons:being_enchanted")
                        }, 20)
                    }
                })
            }
        }, 21)
    }
})

function getEvent(entity) {
    const id = entity.typeId
    if (id == "minecraft:zombie" || id == "minecraft:husk" || id == "dungeons:jungle_zombie" || id == "dungeons:frozen_zombie") {
        const baby = entity.getComponent("is_baby")
        if (baby) return "dungeons:become_enchanted_baby"
        if (!baby) return "dungeons:become_enchanted_adult"
    }
    if (id == "minecraft:drowned") {
        const baby = entity.getComponent("is_baby")
        if (baby) {
            if (entity.getProperty("dungeons:armour_type") !== undefined) {
                const armourType = entity.getProperty("dungeons:armour_type")
                if (armourType == 0) return "dungeons:become_enchanted_baby_t1"
                if (armourType == 1) return "dungeons:become_enchanted_baby_t2"
                if (armourType == 2) return "dungeons:become_enchanted_baby_t3"
            }
            return "dungeons:become_enchanted_baby"
        } else {
            if (entity.getProperty("dungeons:armour_type") !== undefined) {
                const armourType = entity.getProperty("dungeons:armour_type")
                if (armourType == 0) return "dungeons:become_enchanted_adult_t1"
                if (armourType == 1) return "dungeons:become_enchanted_adult_t2"
                if (armourType == 2) return "dungeons:become_enchanted_adult_t3"
            }
            return "dungeons:become_enchanted_adult"
        }
    }
    if (id == "minecraft:spider" || id == "minecraft:cave_spider") {
        return "dungeons:become_enchanted_normal"
    }
    if (id == "minecraft:pillager" || id == "minecraft:vindicator") {
        if (entity.getProperty("dungeons:armour_type") !== undefined) {
            const armourType = entity.getProperty("dungeons:armour_type")
            if (armourType == 0) return "dungeons:become_enchanted_regular"
            if (armourType == 1) return "dungeons:become_enchanted_golden"
            if (armourType == 2) return "dungeons:become_enchanted_diamond"
        }
        return "dungeons:become_enchanted_regular"
    }
    if (id == "minecraft:sunken_skeleton") {
        if (entity.getProperty("dungeons:armour_type") !== undefined) {
            const armourType = entity.getProperty("dungeons:armour_type")
            if (armourType == 0) return "dungeons:become_enchanted_t1"
            if (armourType == 1) return "dungeons:become_enchanted_t2"
            if (armourType == 2) return "dungeons:become_enchanted_t3"
        }
        return "dungeons:become_enchanted"
    }
    return "dungeons:become_enchanted"
}