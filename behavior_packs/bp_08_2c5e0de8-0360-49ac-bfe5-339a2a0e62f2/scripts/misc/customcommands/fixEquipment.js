import { world, system } from "@minecraft/server";


system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const fixme = {
        name: "dungeons:fixequipment",
        description: "Fully repairs all items in the inventory, good for testing",
        cheatsRequired: true,
        permissionLevel: 1
    }
    registry.registerCommand(fixme,
        (source, bool) => {
            system.run(() => {
                const player = source.sourceEntity;
                if (!player) return;
                const feedback = world.gameRules.sendCommandFeedback

                const equippable = player.getComponent("equippable")
                if(!equippable) return;
                var didAnything = false
                const armor = [
                    "Head",
                    "Chest",
                    "Legs",
                    "Feet",
                    "Offhand"
                ]
                for(const slot of armor) {
                    const piece = equippable.getEquipment(slot)
                    if(!piece) continue;
                    const durability = piece.getComponent("durability")
                    if(!durability) continue;
                    if(durability.damage > 0) {
                        didAnything = true
                        durability.damage = 0
                        equippable.setEquipment(slot, piece)
                    }
                }
                const inventory = player.getComponent("inventory")
                const container = inventory.container;
                for(let i = 0; i<container.size; i++) {
                    const item = container.getItem(i)
                    if(!item) continue;
                    const durability = item.getComponent("durability")
                    if(!durability) continue;
                    if(durability.damage > 0) {
                        didAnything = true
                        durability.damage = 0
                        container.setItem(i, item)
                    }
                }
                if(didAnything && feedback) {
                    player.sendMessage("All equipment repaired! :)")
                    player.playSound("random.anvil_use", {pitch: Math.random() + 0.5})
                }  else if(!didAnything && feedback) {
                    player.sendMessage("Nothing was found that needed repairing")
                }
            })
        }
    );
});