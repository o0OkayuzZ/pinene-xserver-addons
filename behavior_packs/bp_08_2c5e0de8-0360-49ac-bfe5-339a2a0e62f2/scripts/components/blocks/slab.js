import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:slab_interact", {
        onPlayerInteract(e) {
            const { block, player, face } = e;
            const equipment = player.getComponent('equippable');
            const selectedItem = equipment.getEquipment('Mainhand');
            if (selectedItem?.typeId === block.typeId && !block.permutation.getState('dungeons:double')) {
                const verticalHalf = block.permutation.getState('minecraft:vertical_half');
                const isBottomUp = verticalHalf === 'bottom' && face === 'Up';
                const isTopDown = verticalHalf === 'top' && face === 'Down';
                if (isBottomUp || isTopDown) {
                    if (player.getGameMode() !== "Creative") {
                        if (selectedItem.amount - 1 === 0) {
                            equipment.setEquipment('Mainhand', undefined);
                        } else {
                            selectedItem.amount -= 1;
                            equipment.setEquipment('Mainhand', selectedItem);
                        }
                    }
                    block.setPermutation(block.permutation.withState('dungeons:double', true));
                    player.playSound('use.stone');
                }
            }
        }
    });
    event.blockComponentRegistry.registerCustomComponent("dungeons:slab_destroy", {})
})

world.beforeEvents.playerBreakBlock.subscribe((e) => {
    const { block, player } = e;
    if (block.getComponent("dungeons:slab_destroy")) {
        if (!player || !player.getComponent('equippable')) {
            return;
        }
        const selectedItem = player.getComponent('equippable').getEquipment('Mainhand');
        const isPickaxe = selectedItem && selectedItem.hasTag('minecraft:is_pickaxe');
        const slabItem = new ItemStack(block.typeId, 1);
        if (isPickaxe) {
            system.run(() => {
                block.dimension.spawnItem(slabItem, block.location);
            })
        }
    }
})