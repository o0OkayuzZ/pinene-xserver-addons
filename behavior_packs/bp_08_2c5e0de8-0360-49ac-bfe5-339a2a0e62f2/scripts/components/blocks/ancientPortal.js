import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:ancient_portal_frame', {

        onPlayerInteract(e) {
            const block = e.block;
            const dim = e.dimension
            const player = e.player;
            const permutation = block.permutation;
            if (permutation.getState("dungeons:unbreakable")) {
                dim.playSound('block.ancient_portal.reject', block.center(), { volume: 0.9, pitch: 0.6 - Math.random() / 5 })
                return;
            }
            const rune = permutation.getState("dungeons:rune")
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            if (!selectedItem) {
                if (rune !== "empty") {
                    equipment.setEquipment("Mainhand", new ItemStack("dungeons:enchanted_rune_" + rune, 1))
                    const newPermutation = permutation.withState('dungeons:rune', "empty");
                    block.setPermutation(newPermutation);
                    dim.playSound('block.ancient_portal.remove_rune', block.center(), { volume: 0.9, pitch: 1 })
                }
                return;
            }
            if (selectedItem.typeId.includes("dungeons:enchanted_rune_") == false) return;
            if (selectedItem.typeId == "dungeons:enchanted_rune_" + rune) return;
            if (!e.player.matches({ gameMode: 'Creative' })) {
                if (selectedItem.amount > 1) {
                    selectedItem.amount -= 1;
                    equipment.setEquipment('Mainhand', selectedItem);
                } else {
                    equipment.setEquipment('Mainhand', undefined);
                }
                if (rune !== "empty") {
                    const spawnItem = new ItemStack("dungeons:enchanted_rune_" + rune, 1)
                    dim.spawnItem(spawnItem, block.center())
                    dim.playSound('block.ancient_portal.remove_rune', block.center(), { volume: 0.4, pitch: 1 })
                }
            }
            const newPermutation = permutation.withState('dungeons:rune', selectedItem.typeId.replace("dungeons:enchanted_rune_", ""));
            block.setPermutation(newPermutation);


            const loc = block.bottomCenter()
            dim.playSound('block.ancient_portal.place_rune', loc, { volume: 0.9, pitch: 1 })
        },
        onBreak(e) {
            const block = e.block;
            const dim = e.dimension
            const player = e.player;
            const permutation = e.brokenBlockPermutation;
            const rune = permutation.getState("dungeons:rune")
            if (rune !== "empty") {
                const spawnItem = new ItemStack("dungeons:enchanted_rune_" + rune, 1)
                dim.spawnItem(spawnItem, block.center())
                dim.playSound('block.ancient_portal.remove_rune', block.center(), { volume: 0.4, pitch: 1 })
            }
        }
    })
})



system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:ancient_portal', {
        onRandomTick(e) {
            e.dimension.playSound("portal.portal", e.block.location, { pitch: Math.random() * 0.4 + 0.8 })
        },
        onBreak(e) {
            const block = e.block;
            const tickingAreaManager = world.tickingAreaManager
            const tickId = `dungeons:dimension_${block.x}_${block.y}_${block.z}`
            tickingAreaManager.createTickingArea(tickId, {
                dimension: block.dimension,
                from: {
                    x: block.x - 8,
                    y: block.y,
                    z: block.z - 8
                },
                to: {
                    x: block.x + 8,
                    y: block.y,
                    z: block.z + 8
                }
            })
            system.runTimeout(() => {
                tickingAreaManager.removeTickingArea(tickId)
            }, 5)
            if (block.dimension.isChunkLoaded(block.location)) breakBlock(block, 0, e.brokenBlockPermutation)
        },
         onTick(e) {
            const dim = e.dimension
            const block = e.block;
            if(dim.isChunkLoaded(block.location)) dim.spawnParticle("dungeons:ancient_portal_active", block)
        }
    })
})

function breakBlock(block, c, permutation) {
    if (c >= 3) return;
    const dim = block.dimension
    if (!permutation) permutation = block.permutation;
    const dir = permutation.getState("minecraft:cardinal_direction")
    var adjacents = [
        block.above(),
        block.below()
    ]
    if (dir == "east" || dir == "west") {
        adjacents.push(block.north())
        adjacents.push(block.south())
        adjacents.push(block.north().above())
        adjacents.push(block.south().above())
        adjacents.push(block.north().below())
        adjacents.push(block.south().below())
    } else if (dir !== undefined) {
        adjacents.push(block.east())
        adjacents.push(block.west())
        adjacents.push(block.east().above())
        adjacents.push(block.west().above())
        adjacents.push(block.east().below())
        adjacents.push(block.west().below())
    } else {
    }

    for (const adj of adjacents) {
        if (adj.typeId == permutation.type.id) {
            const adjPerm = adj.permutation
            if (adjPerm.getState("minecraft:cardinal_direction") == dir) breakBlock(adj, c + 1)
        } else if (adj.typeId == "dungeons:gilded_obsidian") {
            adj.setPermutation(adj.permutation.withState("dungeons:unbreakable", false))
        } else if (adj.typeId == "dungeons:ancient_portal_frame") {
            adj.setPermutation(adj.permutation.withState("dungeons:unbreakable", false).withState("dungeons:rune", "empty"))
            dim.playSound('block.ancient_portal.remove_rune', block.center(), { volume: 0.3, pitch: 1 })
        }
    }
    if (permutation.type.id == "dungeons:ancient_portal") {
        block.dimension.runCommand(`setblock ${block.x} ${block.y} ${block.z} air destroy`)
    }

}