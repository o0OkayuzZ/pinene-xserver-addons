import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"

const effectId = "dungeons:poison"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    if (e.damage <= 0) return;
    system.run(() => {
        if (hurt.getEffect("fatal_poison")) return;
        var amplifier = 0
        if (isWearingSet(attacker, "dungeons:poison_focus")) amplifier += 1
        hurt.addEffect("fatal_poison", 100, { amplifier: amplifier })
    })
});