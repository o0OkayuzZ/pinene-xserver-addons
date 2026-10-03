import {
    world,
    system,
    BlockVolume,
    BlockPermutation
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:bonus_door', {

        onPlayerInteract(e) {
            const block = e.block;
            const dim = e.dimension
            const player = e.player;
            const permutation = block.permutation;
            if (permutation.getState("dungeons:filled")) {
                dim.playSound('block.ancient_portal.reject', block.center(), { volume: 0.9, pitch: 0.6 - Math.random() / 5 })
                return;
            }
            const rune = permutation.getState("dungeons:rune")
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            if (!selectedItem) {
                 dim.playSound('block.ancient_portal.reject', block.center(), { volume: 0.9, pitch: 0.6 - Math.random() / 5 })
                return;
            }
            if (selectedItem.typeId.includes("dungeons:enchanted_rune_") == false) return;
            if (selectedItem.typeId !== "dungeons:enchanted_rune_" + rune) return;
            if (!e.player.matches({ gameMode: 'Creative' })) {
                if (selectedItem.amount > 1) {
                    selectedItem.amount -= 1;
                    equipment.setEquipment('Mainhand', selectedItem);
                } else {
                    equipment.setEquipment('Mainhand', undefined);
                }
            }
            const newPermutation = permutation.withState('dungeons:rune', selectedItem.typeId.replace("dungeons:enchanted_rune_", "")).withState("dungeons:filled",true);
            block.setPermutation(newPermutation);


            const loc = block.bottomCenter()
            dim.playSound('block.ancient_portal.place_rune', loc, { volume: 0.9, pitch: 1 })

            const othersChecks = [
                block.north(),
                block.north(2),
                block.east(),
                block.east(2),
                block.west(),
                block.west(2),
                block.south(),
                block.south(2)
            ]
            const founds = [block]
            var count = 0
            var sides = [{x:0,z:0},{x:1,z:0},{x:-1,z:0}]
            for(const check of othersChecks) {
                if(!check) continue;
                if(check.typeId == "dungeons:bonus_door" && check.permutation.getState("dungeons:filled") == true) {
                    if(count == 0 && block.x !== check.x) sides = [{x:0,z:0},{x:0,z:-1},{x:0,z:1}]
                    count += 1
                    if(count <= 2) founds.push(check)
                    }
            }
            if(count < 2) return;
            //open

            for(const marker of dim.getEntities({type: "dungeons:ancient_hunt_bonus_room_marker", maxDistance:32, location: block.location})) {
                const mLoc = marker.location
                if(dim.isChunkLoaded(mLoc)) {
                    const plushBlock = dim.getBlock(mLoc)
                    if(plushBlock && plushBlock.hasTag("dungeons:ancient_hunt_trophy")) plushBlock.setType("air")
                }
            }


            for(const newBlock of founds) {
                for(let i = 0; i < 5; i++) {
                    for(let j = 0; j <= 2; j++) {
                        const offset = sides[j]
                        const timeOut = system.runTimeout(() => {
                            try {
                            const searchAt = dim.getBlock({
                                x:newBlock.x + offset.x, 
                                y:newBlock.y - (i+1),
                                z:newBlock.z + offset.z
                            })
                            if(!searchAt || searchAt.typeId !== "dungeons:bonus_door_gate") return system.clearRun(timeOut)
                            dim.runCommand(`setblock ${searchAt.x} ${searchAt.y} ${searchAt.z} air destroy`)
                            } catch(e) {
                                return system.clearRun(timeOut)
                            }
                        
                        },i)
                    }
                }
            }
        },
        onTick(e) {
            const block = e.block;
            const dim = e.dimension
            if(!block || dim.id.includes("dungeons:ancientdim_") == false) return;
            if(dim.getPlayers({location: block.location, maxDistance: 24}).length == 0) return;
            const corner1 = {
                x:block.x + 11,
                y:block.y,
                z:block.z+11
            }
            const corner2 = {
                x:block.x - 11,
                y:block.y-8,
                z:block.z-11
            }
            const vol = new BlockVolume(corner1, corner2)
            const unbreakableGilded = BlockPermutation.resolve("dungeons:gilded_obsidian").withState("dungeons:unbreakable", true);

            if (!dim.containsBlock(vol, { includePermutations: [unbreakableGilded] }, true)) {
                block.setType("minecraft:chiseled_tuff")
            }
        }
    })
})




world.beforeEvents.playerBreakBlock.subscribe((e) => {
    if (e.player.dimension.id.includes("dungeons:ancientdim_")) {
        const block = e.block
        if (!block.hasTag("dungeons:ancient_hunt_trophy")) return;
        const dim = block.dimension
        system.run(() => {
            dim.spawnEntity("dungeons:ancient_hunt_bonus_room_marker", block.location)
        })

    }
})