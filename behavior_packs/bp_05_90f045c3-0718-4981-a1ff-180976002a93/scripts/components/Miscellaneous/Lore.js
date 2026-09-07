import { CommandPermissionLevel, CustomCommandParamType, CustomCommandStatus, EquipmentSlot, system, world } from "@minecraft/server";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:lore', '');
const Slots = Object.values(EquipmentSlot);
system.runJob(SetLore());
function* SetLore() {
    if (!world.getDynamicProperty('stop_lore')) {
        const players = world.getPlayers();
        for (const player of players) {
            if (!player.isValid)
                continue;
            const inv = player.inventory?.container;
            for (let i = 0; i < inv.size; i++) {
                const slot = inv.getSlot(i);
                if (!slot.hasItem())
                    continue;
                const component = slot.getItem().getComponent('true_dn:lore');
                if (!component)
                    continue;
                const lore = component.customComponentParameters.params;
                if (!Array.isArray(lore) || !lore.length)
                    continue;
                slot.setLore(lore);
            }
            const { equippable } = player;
            for (const s of Slots) {
                const slot = equippable.getEquipmentSlot(s);
                if (!slot.hasItem())
                    continue;
                const component = slot.getItem().getComponent('true_dn:lore');
                if (!component)
                    continue;
                const lore = component.customComponentParameters.params;
                if (!Array.isArray(lore) || !lore.length)
                    continue;
                slot.setLore(lore);
            }
            yield;
        }
    }
    system.runJob(SetLore());
}
system.beforeEvents.startup.subscribe(({ customCommandRegistry: CommandRegistry }) => {
    CommandRegistry.registerEnum('true_dn:state', ['enable', 'disable']);
    CommandRegistry.registerCommand({
        name: 'true_dn:lore',
        description: 'Enable/disable lore for the Deathnerite Add-On',
        permissionLevel: CommandPermissionLevel.Admin,
        cheatsRequired: false,
        optionalParameters: [
            {
                name: 'true_dn:state',
                type: CustomCommandParamType.Enum
            }
        ]
    }, (_o, args) => {
        console.warn(args[0]);
        world.setDynamicProperty('stop_lore', !args[0]);
        return {
            status: CustomCommandStatus.Success,
            message: `Lore set to ${args[0]}`,
        };
    });
});
export default component;
