export function shouldRecoverBuddingAmethyst(event, doTileDrops) {
    if (!doTileDrops || event.brokenBlockPermutation?.type?.id !== "minecraft:budding_amethyst") return false;
    const mode = String(event.player.getGameMode()).toLowerCase();
    if (mode !== "survival" && mode !== "adventure") return false;
    const tool = event.itemStackBeforeBreak;
    if (!tool?.typeId?.endsWith("_pickaxe")) return false;
    return tool.getComponent("minecraft:enchantable")?.hasEnchantment("silk_touch") === true;
}
