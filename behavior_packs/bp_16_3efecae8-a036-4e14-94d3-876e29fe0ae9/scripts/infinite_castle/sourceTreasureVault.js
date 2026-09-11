import { ItemStack, EnchantmentType } from "@minecraft/server";

export function isTreasureVault(placement) {
    return placement.category === "room" && placement.variantId === "castle_part_002_up_r3"
        && placement.materialTheme === "rare" && placement.rareRoomType === "treasure_vault";
}

// A guaranteed useful first reward set; tuning is independent of the receipt
// stored by the encounter ledger. Prepare every item before committing it.
export function createVaultReward() {
    const book = new ItemStack("minecraft:enchanted_book", 1);
    const component = book.getComponent("minecraft:enchantable");
    if (!component) throw new Error("vault reward book has no enchantable component");
    component.addEnchantment({ type: new EnchantmentType("unbreaking"), level: 3 });
    return [
        new ItemStack("minecraft:diamond", 3),
        new ItemStack("minecraft:emerald", 8),
        new ItemStack("minecraft:gold_ingot", 12),
        book,
    ];
}
