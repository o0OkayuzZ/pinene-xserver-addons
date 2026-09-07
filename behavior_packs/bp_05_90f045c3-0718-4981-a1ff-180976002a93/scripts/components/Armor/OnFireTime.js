import { EquipmentSlot, system, world } from "@minecraft/server";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:on_fire_time', '', { value: 0 });
const FireTime = new Map();
system.runInterval(() => {
    const players = world.getPlayers();
    for (const player of players) {
        const onFire = player.getComponent('onfire');
        if (!onFire) {
            FireTime.delete(player.id);
            continue;
        }
        const remaining = onFire.onFireTicksRemaining;
        const time = FireTime.get(player.id);
        if (time && time <= remaining)
            continue;
        // const block = player.dimension.getBlock(player.location);
        // if (block?.typeId.match(/lava|fire/) || block?.above()?.typeId.match(/lava|fire/)) continue;
        const equippable = player.equippable;
        let modifier = 0;
        Object.values(EquipmentSlot).forEach(s => {
            if (['Mainhand', 'Offhand'].includes(s))
                return;
            const item = equippable.getEquipment(s);
            if (!item)
                return;
            const params = component.getParamsFrom(item);
            modifier += params?.value ?? 0;
        });
        const total = remaining + modifier * 20;
        if (total <= 0) {
            player.extinguishFire(false);
            FireTime.delete(player.id);
            continue;
        }
        player.setOnFire(total / 20);
        FireTime.set(player.id, total);
    }
});
export default component;
