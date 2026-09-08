import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:fire_aspect"

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
    if (!heldItem.hasTag(effectId) && heldItem.getDynamicProperty("dungeons:gild") !== effectId) return;
    //effect code
    if (e.damage <= 0) return;
    system.run(() => {
        const isFire = hurt.setOnFire(4 + e.damage * 1.2, true)
        if (!isFire) return;
        attacker.dimension.playSound('mob.ghast.fireball', hurt.location, {
            pitch: 1.05,
            volume: 0.33
        })
    })
});