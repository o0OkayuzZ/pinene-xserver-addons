import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

world.afterEvents.itemStartUse.subscribe((e) => {
    const player = e.source
    const item = e.itemStack;
    if (!item) return;
    const rushSpear = item.getComponent("dungeons:rush_spear")
    if (!rushSpear) return;
    player.addTag("dungeons:rush_spear_charged")
})
world.afterEvents.itemStopUse.subscribe((e) => {
    const player = e.source
    const item = e.itemStack;
    if (!item) return;
    const rushSpear = item.getComponent("dungeons:rush_spear")
    if (!rushSpear) return;
    player.removeTag("dungeons:rush_spear_charged")
})

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:rush_spear', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!hit) return;
            if (!attacker.isValid || !hit.isValid) return;
            const dim = hit.dimension;
            const targetLoc = hit.location;
            dim.playSound("weapon.rush_spear.attack", targetLoc, { volume: 1, pitch: 1 })
            if (!attacker.hasTag("dungeons:rush_spear_charged")) return;


            const v = attacker.getVelocity()
            hit.applyKnockback({ x: v.x * 4.5, z: v.z * 4.5 }, 0.23)
        }
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
    if (!heldItem.getComponent("dungeons:rush_spear")) return;
    if (!attacker.hasTag("dungeons:rush_spear_charged")) return;
    //effect code
    if (e.damage <= 0) return;
    const base = e.damage
    e.damage = e.damage * 1.2
    if (e.damage > base + 8) e.damage = base + 8
});

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    entity.removeTag("dungeons:rush_spear_charged")
})