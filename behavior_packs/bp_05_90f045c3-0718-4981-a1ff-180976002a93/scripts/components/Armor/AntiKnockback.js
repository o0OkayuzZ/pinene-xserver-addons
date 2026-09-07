import { afterEvents, Vector } from "../../libraries/utils";
import { EquipmentSlot } from "@minecraft/server";
import { Component } from "../../libraries/Component";
const component = new Component('true_dn:anti_knockback', '', { resistance: 1 });
afterEvents.entityHurt.subscribe(({ hurtEntity: player, damageSource: { damagingEntity: other } }) => {
    if (!player?.isPlayer())
        return;
    const equippable = player.equippable;
    let antiKnockback = 0;
    Object.values(EquipmentSlot).forEach(s => {
        if (['Mainhand', 'Offhand'].includes(s))
            return;
        const item = equippable.getEquipment(s);
        if (!item)
            return;
        const params = component.getParamsFrom(item);
        antiKnockback += params?.resistance ?? 0;
    });
    if (!antiKnockback)
        return;
    const { x, z } = other?.isValid ? Vector.subtract(player.location, other.location).normalize() : Vector.down;
    const hand = other?.equippable?.getEquipment(EquipmentSlot.Mainhand);
    const ench = hand?.enchantable;
    const extra = ench?.getEnchantment(hand.typeId.includes('bow') ? 'punch' : 'knockback')?.level ?? 0;
    player.applyKnockback(new Vector(x, 0, z).multiply(0.5 - antiKnockback + (extra / 10)), 0.3 - (antiKnockback / 5));
});
export default component;
