

import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:explorer_map', {
        onUse(e, p) {
            const player = e.source;
            const dim = player.dimension;
            if(player.dimension.id != "minecraft:overworld") return player.sendMessage({translate: "dungeons.warn.map_overworld"})
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            const type = p.params.type
            if (!selectedItem) return;
            const lootTableManager = world.getLootTableManager()
            const table = lootTableManager.getLootTable(`map/${type}`)
            const loot = lootTableManager.generateLootFromTable(table)
            for (const item of loot) {
                var newName = { rawtext: [{ text: "§r§9" }, { translate: item.nameTag }, { text: "§r" }] }
                item.setLore([newName])
                item.nameTag = "§r§eExplorer Map"
                equipment.setEquipment("Mainhand", item)
            }
        }
    })
})
