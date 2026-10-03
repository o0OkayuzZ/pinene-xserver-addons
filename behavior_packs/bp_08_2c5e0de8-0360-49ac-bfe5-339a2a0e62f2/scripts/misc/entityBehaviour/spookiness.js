import {
    world,
    system
} from "@minecraft/server";

const forceSpookiness = false

export function spookyMonth() {
    const month = new Date().getMonth();
    if (month == 9) return true
    return forceSpookiness
}

var spooky = false

system.run(() => {
    spooky = spookyMonth()
    if(spooky == true) {
        const spookyTimer = system.runInterval(() => {
            if(spookyMonth() == false) {
                spooky = false
                console.warn("Spookiness is off")
                system.clearRun(spookyTimer)
            }
        }, 600)
    }
})

function spookify(entity, vfx) {
    const dim = entity.dimension
    const loc = entity.location
    if(dim.isChunkLoaded(loc) && vfx) {
        dim.spawnParticle("minecraft:ice_evaporation_emitter", {x:loc.x,y:loc.y+1,z:loc.z})
        dim.spawnParticle("dungeons:spooky_flame", {x:loc.x,y:loc.y+1,z:loc.z})
    }
    entity.setProperty("dungeons:spooky", true)
    entity.addTag("dungeons:costumed")
}
function despookify(entity) {
    const dim = entity.dimension
    const loc = entity.location
    if(dim.isChunkLoaded(loc)) {
        dim.spawnParticle("minecraft:ice_evaporation_emitter", {x:loc.x,y:loc.y+1,z:loc.z})
        dim.spawnParticle("dungeons:spooky_flame", {x:loc.x,y:loc.y+1,z:loc.z})
    }
    entity.setProperty("dungeons:spooky", false)
    entity.removeTag("dungeons:costumed")
}


world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    const entity = e.entity;
    const id = e.eventId;
    if(id == "dungeons:spawn_spooky" && entity.isValid) spookify(entity, false)
    if(id == "dungeons:start_waking" && entity.isValid && spooky && entity.typeId == "dungeons:redstone_golem_resting" && Math.random() <= 0.5) spookify(entity, true)
    if(id == "dungeons:start_waking" && entity.isValid && spooky && entity.typeId == "dungeons:jungle_abomination_resting" && Math.random() <= 1) spookify(entity, true)
    if(id == "dungeons:start_waking" && entity.isValid && spooky && entity.typeId == "dungeons:vengeful_heart_of_ender_resting" && Math.random() <= 0.66) spookify(entity, true)
    if(id == "dungeons:start_cutscene" && entity.isValid && spooky && entity.typeId == "dungeons:vengeful_heart_of_ender_resting" && Math.random() <= 0.66) spookify(entity, true)
})

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    const cause = e.cause
    if(!spooky) return;
    system.runTimeout(() => {
        if(!entity.isValid) return;
        if(cause == "Spawned" && entity.typeId == "dungeons:wraith" && Math.random() <= 0.25) spookify(entity, true)
        if(cause == "Spawned" && entity.typeId == "dungeons:redstone_golem" && Math.random() <= 0.5) spookify(entity, true)
        if(cause == "Spawned" && entity.typeId == "dungeons:jungle_abomination" && Math.random() <= 1) spookify(entity, true)
        if(cause == "Spawned" && entity.typeId == "dungeons:vengeful_heart_of_ender" && Math.random() <= 0.66) spookify(entity, true)
        if(cause == "Spawned" && entity.typeId == "dungeons:whisperer" && Math.random() <= 0.25) spookify(entity, true)
        if(cause == "Spawned" && entity.typeId == "dungeons:leapleaf" && Math.random() <= 0.3) spookify(entity, true)
    },1)
})

system.runInterval(() => {
    if(spooky) return;
    const dims = []
    for(const player of world.getAllPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for(const dimId of dims) {
        const dim = world.getDimension(dimId)
        for(const costumed of dim.getEntities({tags: ["dungeons:costumed"], excludeTags: ["dungeons:costume_locked"], propertyOptions: [{propertyId: "dungeons:spooky", value: true }]})) {
            const nameTag = costumed.nameTag
            if(nameTag.length > 0) {
                costumed.addTag("dungeons:costume_locked")
                continue;
            }
            despookify(costumed)
        }
    }
})