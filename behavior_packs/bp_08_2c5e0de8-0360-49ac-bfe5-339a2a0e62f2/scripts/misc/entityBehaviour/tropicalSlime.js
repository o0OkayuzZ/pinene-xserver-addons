import {
    world,
    system,
    MolangVariableMap
} from "@minecraft/server";

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (!deadEntity) return;
    if (!deadEntity.isValid) return;
    if (deadEntity.matches({
        type: "dungeons:tropical_slime"
    })) {
        system.runTimeout(() => {
            const dim = deadEntity.dimension;
            const loc = deadEntity.location;
            const variant = deadEntity.getComponent("variant").value
            const spawnId = deadEntity.typeId
            if(variant == 1) return;
            var event = "spawn_small"
            if(variant == 4) event = "spawn_medium"
            var i = 0
            const runInt = system.runInterval(() => {
                i += 1
                const slimes = dim.getEntities({ location: loc, maxDistance: 4, type: "minecraft:slime", excludeTags:["dungeons:tropical_slimetag"] })
                if(slimes.length > 0) {
                    for (const slime of slimes) {
                        if (slime.typeId == "minecraft:slime" && !slime.hasTag("dungeons:tropical_slimetag")) {
                            slime.dimension.spawnEntity(spawnId, slime.location, {spawnEvent: event})
                            slime.remove()
                        }
                    }
                }
                if(i > 9) return system.clearRun(runInt)
            })
            system.runTimeout(() => {
                createWaterBreath(dim, loc, variant)
            }, 4)
        }, 16)
    }
})

function createWaterBreath(dim, loc, size) {
    const map = new MolangVariableMap()
    map.setFloat("variable.cloud_radius", 2)
    map.setFloat("variable.particle_multiplier", 3)
    map.setFloat("variable.cloud_lifetime", 1)
    map.setColorRGBA("variable.color", {red: 0, green: 0.5, blue:0.8, alpha: 1})
    dim.spawnParticle("minecraft:mobspell_lingering", loc, map)
    dim.spawnParticle("minecraft:bubble_column_up", loc)
    const targets = dim.getEntities({maxDistance: size/4 + 3, location: loc})
    for(const target of targets) {
        target.addEffect("water_breathing", size*60)
        const onfire = target.getComponent("onfire")
        if(onfire) target.extinguishFire(true)
        for(let i = 0; i < Math.floor(Math.random()*4) + 5; i++) {
            const randX = target.location.x + (Math.random()*5)-2.5
            const randZ = target.location.z + (Math.random()*5)-2.5
            if(dim.isChunkLoaded({x:randX, y:target.location.y, z:randZ})) dim.spawnParticle("minecraft:bubble_column_up_particle", {x:randX, y:target.location.y, z:randZ})
        }
    }
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.typeId !== "minecraft:slime") return;
    system.runTimeout(() => {
        if (entity.isValid) entity.addTag("dungeons:tropical_slimetag")
    }, 2)
})

world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const id = e.eventId
    if(id !== "dungeons:tick") return;
    const entity = e.entity
    if(!entity.isValid) return;
    if(entity.typeId !== "dungeons:tropical_slime") return;
    const onfire = entity.getComponent("onfire")
    if(onfire && Math.random() > 0.8) entity.extinguishFire(true)
    if(entity.hasTag("dungeons:tropical_slime_in_air")) {
        if(entity.isInWater == false || entity.isOnGround) return entity.removeTag("dungeons:tropical_slime_in_air")
            const facing = entity.getViewDirection()
            entity.applyImpulse({x:facing.x*0.02, y:-0.05 + facing.y*0.01, z:facing.z*0.02})
    } else {
        if(entity.isInWater == false || entity.isOnGround) return;
        entity.applyImpulse({x:0,y:0.03,z:0})
        const topMost = entity.dimension.getTopmostBlock({x:entity.location.x,z:entity.location.z},entity.location.y)
        if(topMost && topMost.y + 3 > entity.location.y) return;
        entity.addTag("dungeons:tropical_slime_in_air")
    }
})