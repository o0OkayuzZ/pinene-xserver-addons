import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:unchanting"

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
    var count = 0
    if (heldItem.hasTag(effectId)) count += 1
    if (heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) count += 1
    if (count == 0) return;
    for (let i = 0; i < count; i++) {
        //effect code
        if (e.damage <= 0) return;
        if (hurt.matches({ families: ["enchanted"] })) {
            const dim = attacker.dimension;
            const targetLoc = hurt.location;
            e.damage = e.damage * 2
            system.run(() => {

                dim.spawnParticle("dungeons:illagers_bane_1", { x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z })
                dim.spawnParticle("dungeons:illagers_bane_2", { x: targetLoc.x, y: targetLoc.y + 1, z: targetLoc.z })
            })
        }
    }
});