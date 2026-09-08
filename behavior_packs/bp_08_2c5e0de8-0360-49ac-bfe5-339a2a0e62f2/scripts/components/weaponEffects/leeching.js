import {
    world,
    system,
    EntityDamageCause,
    MolangVariableMap
} from "@minecraft/server";
import { specialDamage, isValidTarget } from "main.js";

const effectId = "dungeons:leeching"



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
    let hp = attacker.getComponent('minecraft:health')

    if (!hp) {
        console.warn('Entity does not have health component');
        return;
    }
    let hurtHp = hurt.getComponent('minecraft:health')

    if (!hurtHp) {
        console.warn('Entity does not have health component');
        return;
    }
    system.runTimeout(() => {
        const maxHeal = 5
        const minHeal = 0.5

        const hurtMaxHP = hurtHp.defaultValue
        const maxHP = hp.defaultValue
        const currentHP = hp.currentValue;

        var amountHealed = hurtMaxHP * 0.05
        if (amountHealed > maxHeal) amountHealed = maxHeal
        if (amountHealed < minHeal) amountHealed = minHeal
        if ((amountHealed + currentHP) > maxHP) {
            hp.setCurrentValue(maxHP)
        } else {
            hp.setCurrentValue(currentHP + amountHealed)
        }
        const dim = hurt.dimension;
        const loc = hurt.location;
        const map = new MolangVariableMap()
        map.setFloat("variable.particle_count", amountHealed)
        dim.spawnParticle('dungeons:leeching_particle', { x: loc.x, y: loc.y + 0.2, z: loc.z }, map)

    }, 18) // waits 0.9 seconds for death to finish

});