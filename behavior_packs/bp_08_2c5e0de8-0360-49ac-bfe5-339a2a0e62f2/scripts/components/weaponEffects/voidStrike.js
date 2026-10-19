import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { addVoidedEffect } from "misc/voidedEffect.js"

const effectId = "dungeons:void_strike"

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
    const hp = hurt.getComponent("health")
    if (hp) {
        if (hp.currentValue <= 0) return;
    }
    system.run(() => {
        var cd = world.scoreboard.getObjective('dungeons:void_strike_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:void_strike_t');
        }
        if (cd.hasParticipant(attacker.scoreboardIdentity)) return;
        cd.setScore(attacker, 80);
        addVoidedEffect(hurt, 80)
        hurt.dimension.playSound("weapon.enchant.void_strike", hurt.location)
    })
});