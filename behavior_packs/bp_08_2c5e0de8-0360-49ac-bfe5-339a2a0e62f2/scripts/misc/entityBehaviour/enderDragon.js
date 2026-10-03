import {
    world,
    system,
    MolangVariableMap
} from "@minecraft/server";

const list = [
    "watchling",
    "blastling",
    "snareling",
    "endersent"
]

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    const cause = e.cause;
    if(!entity || !entity.isValid) return;
    const dim = entity.dimension
    if(!list.includes(entity.typeId.replace("dungeons:",""))) return;
    if(entity.dimension.id !== "minecraft:the_end") return;
    const loc = entity.location;
    const dragons = dim.getEntities({type: "ender_dragon", maxDistance:150, location:loc})
    if(dragons.length == 0) {
        if(Math.random() > 0.5) {
            return
        } else {
            if(!(loc.x < 250 && loc.x > -250 && loc.z < 250 && loc.z > -250)) return;
        }
    };
    var spawn = true
    if(entity.typeId == "dungeons:endersent") spawn = false
    if(entity.typeId == "dungeons:blastling" && Math.random() > 0.66) spawn = false
    if(entity.typeId == "dungeons:snareling" && Math.random() > 0.44) spawn = false
    if(entity.typeId == "dungeons:watchling" && Math.random() > 0.8) spawn = false
    if(spawn == false) {
        
    if(world.getDifficulty() == "Hard") return;
    if(world.getDifficulty() == "Normal" && Math.random() > 0.77) return;
    entity.remove()
    if(Math.random() > 0.1) dim.spawnEntity("minecraft:enderman", loc)
    }
})