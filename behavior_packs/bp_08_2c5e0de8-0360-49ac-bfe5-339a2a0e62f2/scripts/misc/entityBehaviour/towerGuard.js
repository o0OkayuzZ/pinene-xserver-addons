import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

//toggle property
world.afterEvents.dataDrivenEntityTrigger.subscribe((e) => {
    if(e.eventId !== "dungeons:speed_check") return;
    const entity = e.entity;
    if(!entity || !entity.isValid || !entity.matches({families: ["tower", "illager"]})) return;
    const v =  entity.getVelocity()
    var x = Math.abs(v.x)
    var z = Math.abs(v.z)
    var charging = entity.getProperty("dungeons:charging")
    if(x > 0.152 || z > 0.152) {
        entity.setProperty("dungeons:charging", true)
        entity.addEffect("speed", 10)
        entity.dimension.spawnParticle("dungeons:potion_barrier", entity.location)
    } else {
        entity.setProperty("dungeons:charging", false)
    }
})

