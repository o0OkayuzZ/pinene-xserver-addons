import { world, EquipmentSlot } from "@minecraft/server";
import "./meitetsu_chest.js";

const STONE_SNOWBALL_ID = "pinematerials:stone_snowball";
const ARMOR_DAMAGE_PER_HIT = 15;

// 石入り雪玉が命中したとき、装備中の鎧耐久を削る
world.afterEvents.projectileHitEntity.subscribe((event) => {
    try {
        if (event.projectile.typeId !== STONE_SNOWBALL_ID) return;

        const hitResult = event.getEntityHit();
        if (!hitResult?.entity) return;

        const target = hitResult.entity;
        const equip = target.getComponent("minecraft:equippable");
        if (!equip) return;

        const slots = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
        for (const slot of slots) {
            const item = equip.getEquipment(slot);
            if (!item) continue;
            const durComp = item.getComponent("minecraft:durability");
            if (!durComp) continue;
            durComp.damage = Math.min(durComp.damage + ARMOR_DAMAGE_PER_HIT, durComp.maxDurability);
            equip.setEquipment(slot, item);
        }
    } catch (e) {}
});
