import { world, system, EntityDamageCause } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_deepsea_monument"

system.runInterval(() => {
    if (!hunts) return;
    const dim = world.getDimension(DIM_ID)
    for(const entity of dim.getEntities({type:"minecraft:item"})) {
        if(entity.isInWater && !entity.isOnGround) entity.applyImpulse({x:0,y:-0.005,z:0})
    }
    for(const entity of dim.getEntities({type:"minecraft:xp_orb"})) {
        if(entity.isInWater && !entity.isOnGround) entity.applyImpulse({x:0,y:-0.05,z:0})
    }
}, 1)