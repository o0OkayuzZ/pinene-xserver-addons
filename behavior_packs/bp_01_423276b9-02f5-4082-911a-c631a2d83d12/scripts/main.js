import { ItemStack, system, world } from "@minecraft/server";

const MARKER_ID = "myname:apply_check_marker";
const BUILD_TAG = "bsl_check_2026_08_28_01";

world.afterEvents.itemUse.subscribe(({ itemStack, source }) => {
  if (!source || source.typeId !== "minecraft:player" || itemStack?.typeId !== MARKER_ID) return;

  if (!source.hasTag(BUILD_TAG)) source.addTag(BUILD_TAG);
  source.sendMessage("[BSL確認] BetterStructureLoot 1.0.7 読み込み済み");
  source.sendMessage("[BSL確認] Gapple Cows 1.0.23 / BlueApple 1.0.4 / Deathnerite 2.12.14");
  source.sendMessage("[BSL確認] 旧・欠落アイテム参照整理済み / 2026-08-28");
  source.onScreenDisplay.setActionBar("BSL 1.0.7 OK");
});

// PINENE_COPPER_REGISTRY_DIAGNOSTIC_BEGIN
system.run(() => {
  const copperIds = [
    "minecraft:copper_sword",
    "minecraft:copper_axe",
    "minecraft:copper_pickaxe",
    "minecraft:copper_shovel",
    "minecraft:copper_hoe",
  ];
  for (const typeId of copperIds) {
    try {
      const stack = new ItemStack(typeId, 1);
      console.info(`[CopperRegistry] ${typeId}=OK resolved=${stack.typeId}`);
    } catch (error) {
      console.error(`[CopperRegistry] ${typeId}=FAILED ${error}`);
    }
  }
});
// PINENE_COPPER_REGISTRY_DIAGNOSTIC_END
