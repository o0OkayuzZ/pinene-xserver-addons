import { EquipmentSlot, GameMode } from "@minecraft/server";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:on_mine_block', 'onMineBlock', { ignore_creative: true, damage: 1 });
component.subscribe(({ minedBlockPermutation: old, source: player, itemStack: item }, { ignore_creative, damage, specific_damage }) => {
    if (!ignore_creative && player.isPlayer() && player.getGameMode() === GameMode.Creative || !item || damage === 0 && !specific_damage?.length)
        return;
    const result = item.damage(specific_damage?.find(s => typeof s.block === 'string' ? s.block === old.type.id : s.block.tags.some(t => old.hasTag(t)))?.damage ?? damage);
    if (!result)
        player.dimension.playSound('random.break', player.location);
    player.equippable?.setEquipment(EquipmentSlot.Mainhand, result);
});
export default component;
