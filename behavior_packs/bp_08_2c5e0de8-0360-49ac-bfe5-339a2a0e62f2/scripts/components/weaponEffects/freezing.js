import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:freezing"

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
        if (hurt.getEffect("slowness")) return;
        hurt.addEffect("slowness", 100, { amplifier: 2 })
        const dim = hurt.dimension;
        const loc = hurt.location
        dim.spawnParticle("dungeons:element_freeze", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.playSound("mob.player.hurt.freeze", loc, {})
    })
});
