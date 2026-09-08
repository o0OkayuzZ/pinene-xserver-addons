import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:critical_hit_spooky"

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
    const critical = Math.floor(Math.random() * 10);
    if (critical == 1) {
        e.damage = e.damage * 2
        system.run(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            dim.spawnParticle("dungeons:spooky_skull_crit", hurtLoc)
            dim.spawnParticle("dungeons:spooky_skull_burst", hurtLoc)
            dim.playSound("random.anvil_land", hurtLoc, { volume: 0.7, pitch: 0.75 })
        })
    }

});