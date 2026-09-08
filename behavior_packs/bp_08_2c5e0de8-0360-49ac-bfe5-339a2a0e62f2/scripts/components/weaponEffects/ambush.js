import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:ambush"

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
    if (attacker.getEffect("invisibility")) {
        e.damage = e.damage * 1.3
        system.run(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            dim.spawnParticle("dungeons:ambush", { x: hurtLoc.x, y: hurtLoc.y + 0.2, z: hurtLoc.z })
            dim.playSound("random.anvil_land", hurtLoc, { volume: 0.2, pitch: 1.5 })
        })
    }
});