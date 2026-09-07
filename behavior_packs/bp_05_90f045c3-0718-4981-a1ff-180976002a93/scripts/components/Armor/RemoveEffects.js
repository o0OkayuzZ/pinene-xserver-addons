import { EquipmentSlot, system, world } from "@minecraft/server";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:remove_effects', '', { cooldown: -1, effect_ids: [] });
// const Slots = Object.values(EquipmentSlot);
// beforeEvents.effectAdd.subscribe((data) => {
//     const { entity: player, effectType } = data;
//     console.warn(effectType);
//     if (!player.isPlayer()) return;
//     const equippable = player.getComponent("minecraft:equippable");
//     for (const slot of Slots) {
//         if (['Mainhand', 'Offhand'].includes(slot)) return;
//         const item = equippable.getEquipment(slot);
//         if (!item) return;
//         const params = component.getParamsFrom(item);
//         if (!params?.effect_ids.includes(effectType)) continue;
//         data.cancel = true;
//         break;
//     }
// });
system.runInterval(() => {
    const players = world.getPlayers();
    for (const player of players) {
        const equippable = player.getComponent("minecraft:equippable");
        if (!equippable) continue;
        let IDs = [];
        Object.values(EquipmentSlot).forEach(s => {
            if (['Mainhand', 'Offhand'].includes(s))
                return;
            const item = equippable.getEquipment(s);
            if (!item)
                return;
            const params = component.getParamsFrom(item);
            if (params === null)
                return;
            IDs.push(...params.effect_ids);
        });
        IDs = [...new Set(IDs)];
        const effects = player.getEffects();
        for (const effect of effects) {
            if (IDs.includes(effect.typeId.split(':')[1]))
                player.removeEffect(effect.typeId);
        }
    }
});
export default component;

