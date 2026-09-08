import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:rampaging"



world.afterEvents.entityDie.subscribe((e) => {
    const hurt = e.deadEntity;
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
    if ((hurt.matches({
        families: ['monster']
    }) || hurt.matches({
        families: ['mob']
    }) || hurt.matches({
        families: ['player']
    }))) {
        if (heldItem.typeId == "dungeons:sparkler") {

            attacker.dimension.spawnParticle('dungeons:sparkler_hit', attacker.location)
        } else {
            attacker.dimension.spawnParticle('dungeons:death_cap_mushroom', attacker.location)
        }
        attacker.addEffect('strength', 140)
        attacker.addEffect('speed', 140)
    }

});