import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:illagers_bane"

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
    if (hurt.matches({ families: ["illager"] })) {
        const dim = attacker.dimension;
        const targetLoc = hurt.location;
        e.damage = e.damage * 1.35
        system.run(() => {

            dim.spawnParticle("dungeons:illagers_bane_1", { x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z })
            dim.spawnParticle("dungeons:illagers_bane_2", { x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z })
        })
    }
});