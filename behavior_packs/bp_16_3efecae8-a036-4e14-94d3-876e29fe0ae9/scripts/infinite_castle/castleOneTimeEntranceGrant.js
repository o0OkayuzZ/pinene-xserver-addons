// Xserver grant is armed explicitly from its console; local worlds remain unarmed.
import { world, system, ItemStack } from "@minecraft/server";
const PLAYER = "o0OkayuzZ";
const ARMED = "infinite_castle:okayuzz_entrance_20260913_armed";
const DONE = "infinite_castle:okayuzz_entrance_20260913_delivered";
const ITEM = "infinite_castle:entrance_marker";

export function deliverEntranceOnce() {
    if (!world.getDynamicProperty(ARMED) || world.getDynamicProperty(DONE)) return false;
    const player = world.getAllPlayers().find(p => p.name.toLowerCase() === PLAYER.toLowerCase());
    if (!player || player.dimension.id === "infinite_castle:dungeon"
        || (player.getComponent("minecraft:health")?.currentValue ?? 0) <= 0) return false;
    const inventory = player.getComponent("minecraft:inventory")?.container;
    if (!inventory) return false;
    for (let i = 0; i < inventory.size; i++) {
        if (inventory.getItem(i)) continue;
        inventory.setItem(i, new ItemStack(ITEM, 1));
        world.setDynamicProperty(DONE, true);
        console.warn(`[castle-one-time-grant] delivered ${ITEM} x1 to ${player.name}`);
        player.sendMessage("§a無限城の入口ブロックを1個受け取りました（一度きりの配布）。");
        return true;
    }
    return false;
}

system.afterEvents.scriptEventReceive.subscribe(event => {
    if (event.id !== "infinite_castle:grant_entrance_20260913" || event.message !== PLAYER) return;
    world.setDynamicProperty(ARMED, true);
    deliverEntranceOnce();
    console.warn(`[castle-one-time-grant] ${world.getDynamicProperty(DONE) ? "already delivered" : "pending login / free inventory slot outside castle"}`);
});
system.runInterval(deliverEntranceOnce, 20);
