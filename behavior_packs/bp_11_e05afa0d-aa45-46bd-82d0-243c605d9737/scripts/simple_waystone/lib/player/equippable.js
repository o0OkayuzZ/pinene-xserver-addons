import { EntityComponentTypes } from "@minecraft/server";
export const apiEquippable = new class apiEquippable {
    getItem(entity, slot) {
        const equippable = entity.getComponent(EntityComponentTypes.Equippable);
        if (!equippable)
            return;
        return equippable.getEquipment(slot);
    }
    setItem(entity, item, slot) {
        const equippable = entity.getComponent(EntityComponentTypes.Equippable);
        if (!equippable)
            return;
        equippable.setEquipment(slot, item);
    }
};
