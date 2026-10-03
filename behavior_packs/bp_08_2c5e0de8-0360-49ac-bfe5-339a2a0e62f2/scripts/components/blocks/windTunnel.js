import {
    world,
    system,
    ItemStack,
    MolangVariableMap
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"


system.run(() => {
    for(const player of world.getPlayers()) {
        for(const tag of player.getTags()) if(tag.includes("dungeons:wind_tunnel_victim_")) player.removeTag(tag)
    }
})

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:wind_tunnel', {
        beforeOnPlayerPlace(e) {
            const player = e.player
            if(!player) return;
            if(player.hasTag("dungeons:place_noticking")) {
                e.permutationToPlace = e.permutationToPlace.withState("dungeons:no_ticking", true)
                console.warn("no ticking placed")
            }
        },
        onTick(e) {
            const block = e.block;
            const dim = e.dimension;
            if(!block) return;
            if(!dim.isChunkLoaded(block.location)) return;
            const noTick = block.permutation.getState("dungeons:no_ticking")
            const dirState = block.permutation.getState("minecraft:cardinal_direction")
            if(!noTick && dim.id.includes("dungeons:ancientdim_") && !world.getDynamicProperty("dungeons:wind_tunnel")) return;
            var push = {x:0, z:0}
            if(dirState == "north") push = {x:0, z:1}
            if(dirState == "west") push = {x:1, z:0}
            if(dirState == "south") push = {x:0, z:-1}
            if(dirState == "east") push = {x:-1, z:0}
            for(let i = 1; i < 15; i++) {
                const checkBlock = dim.getBlock({x:block.x + ((i-1)*push.x), y:block.y, z: block.z + ((i-1)*push.z)})
                if(checkBlock && dim.isChunkLoaded(checkBlock.location)) {
                    if(i > 1 && !checkBlock.isAir) return;
                    if(Math.random() > 0.95 && i < 8) {
                        const map = new MolangVariableMap()
                        map.setFloat("variable.x", push.x + Math.random()*0.1 - 0.05)
                        map.setFloat("variable.z", push.z + Math.random()*0.1 - 0.05)
                        map.setFloat("variable.y", Math.random()*0.1 - 0.05)
                        dim.spawnParticle("dungeons:wind_box", checkBlock.center(), map)
                    }
                    const targets = dim.getEntitiesAtBlockLocation(checkBlock.location)
                    for(const mob of targets) {
                        const tag_end = `${push.x}${push.z}`
                        const tag = "dungeons:wind_tunnel_victim_" + tag_end
                        if(mob.hasTag(tag)) continue;
                        mob.addTag(tag)
                        system.runTimeout(() => {
                            if(mob.isValid) {
                                mob.removeTag(tag)
                            }
                        },1)
                        var knockbackResistance = 0
                        if(mob.matches({families:["enchanted"]})) knockbackResistance = 0.2
                        if(mob.typeId == "minecraft:hoglin") knockbackResistance += 0.6
                        if(mob.typeId == "minecraft:zoglin") knockbackResistance += 0.6
                        if(mob.matches({families:["irongolem"]})) knockbackResistance += 1
                        if(mob.matches({families:["ravager"]})) knockbackResistance += 0.75
                        if(mob.matches({families:["shulker"]})) knockbackResistance += 1.0
                        if(mob.matches({families:["warden"]})) knockbackResistance += 1.0
                        if(mob.typeId == "dungeons:royal_guard") knockbackResistance += 0.33
                        if(mob.typeId == "dungeons:enchanted_royal_guard") knockbackResistance += 0.33
                        if(mob.typeId == "dungeons:mountaineer") knockbackResistance += 0.9
                        if(mob.typeId == "dungeons:enchanted_mountaineer") knockbackResistance += 0.9
                        if(mob.typeId == "dungeons:windcaller") knockbackResistance += 1
                        if(mob.typeId == "minecraft:breeze") knockbackResistance += 1
                        if(mob.typeId == "minecraft:player") {
                            if(mob.isFlying) knockbackResistance = 1
                            if(isWearingSet(mob, "dungeons:climbing_armour")) knockbackResistance += 0.75
                            const equippable = mob.getComponent("equippable")
                            const slots = [
                                equippable.getEquipment("Feet"),
                                equippable.getEquipment("Legs"),
                                equippable.getEquipment("Chest"),
                                equippable.getEquipment("Head")
                            ]
                            for(const item of slots) {
                                if(item && item.typeId.includes("minecraft:netherite_")) knockbackResistance += 0.125
                            }
                        }
                        if(mob.hasTag("dungeons:ancient_hunt")) {
                            knockbackResistance = Math.max(knockbackResistance+0.1, 0.5)
                        }
                        if(mob.typeId == "minecraft:player") {
                            const val = Math.max(Math.abs(push.z/5)* (1 - Math.min(knockbackResistance, 1)),Math.abs(push.x/5)* (1 - Math.min(knockbackResistance, 1)))
                            mob.runCommand(`camerashake add @s ${val/5} 1`)
                        }
                        mob.applyImpulse({x:(push.x/5)* (1 - Math.min(knockbackResistance, 1)), y:0.01 * (1 - Math.min(knockbackResistance,1)) * !mob.isOnGround, z:(push.z/5)* (1 - Math.min(knockbackResistance, 1))})
                    }
                    
                } else {
                    return;
                }
            }
        }
    })
})


system.runInterval(() => {
    world.setDynamicProperty("dungeons:wind_tunnel", true)
    system.runTimeout(() => {
        world.setDynamicProperty("dungeons:wind_tunnel", false)
    },100)
}, 200)