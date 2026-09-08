

import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:enchanted_map', {
        onUse(e) {
            const player = e.source;
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            if (!selectedItem) return;
            if (player.getGameMode() !== "Creative") {
                if (selectedItem.amount > 1) {
                    selectedItem.amount -= 1;
                    equipment.setEquipment('Mainhand', selectedItem);
                } else {
                    equipment.setEquipment('Mainhand', undefined);
                }
            }

            player.runCommand('function loot/endersentMap');
        }
    })
})
