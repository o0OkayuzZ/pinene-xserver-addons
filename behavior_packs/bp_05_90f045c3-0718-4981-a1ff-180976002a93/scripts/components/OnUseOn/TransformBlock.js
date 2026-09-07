import { EquipmentSlot, GameMode, system } from "@minecraft/server";
import { Component } from "../../libraries/Component";
import { beforeEvents } from "../../libraries/utils";
const component = new Component('true_dn:transform_block', 'onUseOn', { affect_ids: [], affect_tags: [], damage: 1 });
beforeEvents.playerInteractWithBlock.subscribe(async (data) => {
    const { block, player, itemStack: item } = data;
    if (!item)
        return;
    const params = component.getParamsFrom(item);
    if (params === null)
        return;
    if (!params.transform_to && !params.specific_transformations)
        throw new Error(`"${item?.typeId}" did not specify "transform_to" or "specific_transformations" at "${component.id}"`);
    if (!item)
        return;
    const specific = params.specific_transformations?.[block.typeId];
    if (specific === null)
        return;
    const affect_ids = [params.affect_ids].flat();
    const affect_tags = [params.affect_tags].flat();
    if (!specific &&
        affect_ids.length && !affect_ids.includes(block.typeId) &&
        affect_tags.length && !affect_tags.some(t => t && block.permutation.hasTag(t)))
        return;
    data.cancel = true;
    await system.waitTicks(1);
    const next = specific ?? params.transform_to;
    block.setType(next);
    if (player.isPlayer() && player.getGameMode() !== GameMode.Creative) {
        const result = item.damage(params.damage);
        if (!result)
            player.dimension.playSound('random.break', player.location);
        player.equippable?.setEquipment(EquipmentSlot.Mainhand, result);
    }
    if (!params.sfx)
        return;
    const { sound, volume, pitch } = params.sfx;
    if (!sound)
        throw new Error(`"${item.typeId}" did not specify "sound" at "${component.id}/sfx"`);
    const v = Array.isArray(volume) ? volume[Math.floor(Math.random() * volume.length)] : volume;
    const p = Array.isArray(pitch) ? pitch[Math.floor(Math.random() * pitch.length)] : pitch;
    for (const id of [sound].flat()) {
        player.dimension.playSound(id, block.center(), { volume: v, pitch: p });
    }
});
export default component;
