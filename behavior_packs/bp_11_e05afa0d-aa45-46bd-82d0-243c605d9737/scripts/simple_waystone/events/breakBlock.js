import { world, system, ItemComponentTypes, GameMode } from "@minecraft/server";
import { warpstonePedestalInfo } from "../lib/warpstonePedestal/info";
import { waystoneInfo } from "../lib/waystone/info";
import { apiWarn } from "../lib/player/warn";
world.beforeEvents.playerBreakBlock.subscribe(ev => {
    const hasSilk = ev.itemStack?.getComponent(ItemComponentTypes.Enchantable)?.hasEnchantment("minecraft:silk_touch") ?? false;
    if (ev.block.hasTag("simple_waystone:waystone"))
        return breakBlockController["simple_waystone:waystone"]?.(ev.player, ev.block, hasSilk);
    if (ev.block.hasTag("simple_waystone:warpstone_pedestal"))
        return breakBlockController["simple_waystone:warpstone_pedestal"]?.(ev.player, ev.block, hasSilk);
});
const breakBlockController = {
    "simple_waystone:waystone": (player, block, hasSilk) => {
        const drop = block.getItemStack();
        system.run(() => { if (drop && !hasSilk && player.getGameMode() != GameMode.Creative)
            block.dimension.spawnItem(drop, { x: block.x + 0.5, y: block.y + 0.5, z: block.z + 0.5 }); });
        if (block.permutation.getState("ws:waystone_on") == false)
            return;
        const bottomBlock = block.permutation.getState("ws:waystone") == 1 ? block : block.below(1);
        if (!bottomBlock)
            return;
        system.run(() => {
            waystoneInfo.removeWaystone(bottomBlock.location, bottomBlock.dimension.id);
            apiWarn.playSound(player, "simple_waystone.block.waystone.unregistered");
        });
    },
    "simple_waystone:warpstone_pedestal": (player, block, hasSilk) => {
        system.run(() => warpstonePedestalInfo.remove(block.location, block.dimension.id));
    }
};
