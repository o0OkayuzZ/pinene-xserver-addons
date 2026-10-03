
import {
    system
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:orange_glowshroom", {
        onPlayerInteract(e) {
            const { block, player } = e;
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            const blockCount = block.permutation.getState("dungeons:block_count")
            if (selectedItem?.typeId === block.typeId && blockCount < 3) {

                if (player.getGameMode() !== "Creative") {
                    if (selectedItem.amount - 1 === 0) {
                        equipment.setEquipment('Mainhand', undefined);
                    } else {
                        selectedItem.amount -= 1;
                        equipment.setEquipment('Mainhand', selectedItem);
                    }
                }
                block.setPermutation(block.permutation.withState('dungeons:block_count', blockCount + 1));
                player.playSound('dig.nether_wart');

            }
        }
    });
})