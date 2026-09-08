import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:mace', {
    });
});

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
    const maceComp = heldItem.getComponent("dungeons:mace")
    if (maceComp == undefined) return;
    const flail = maceComp.customComponentParameters.params.flail;
    //effect code
    var isCrit = true
    if (attacker.typeId !== "minecraft:player") return;
    if (attacker.getEffect("slow_falling") || attacker.getEffect("blindness")) isCrit = false;
    if (attacker.isFlying) isCrit = false;
    if (attacker.inWater) isCrit = false;
    const v = attacker.getVelocity()
    if (v.y >= -0.075) isCrit = false;
    const dim = hurt.dimension;
    const targetLoc = hurt.location
    if (isCrit == true) {
        e.damage = e.damage * 4 / 3
        system.run(() => {
            if (flail) {
                dim.playSound("weapon.flail.critical", targetLoc, { volume: 0.8, pitch: 1 })
            } else {
                dim.playSound("weapon.mace.critical", targetLoc, { volume: 0.8, pitch: 1 })

            }
        })
    } else {
        system.run(() => {
            dim.playSound("weapon.mace.hit", targetLoc, { volume: 0.8, pitch: 1 })
        })

    }
})