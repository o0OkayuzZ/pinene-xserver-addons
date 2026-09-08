import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:busy_bee"

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
    if (critical <= 3) {
        system.run(() => {
            const dim = hurt.dimension
            const hurtLoc = hurt.getHeadLocation();
            const pet = dim.spawnEntity('dungeons:pet_bee', hurtLoc);
            let beeTameable = pet.getComponent('minecraft:tameable')
            beeTameable.tame(attacker);
            dim.spawnParticle("dungeons:busy_bee_spawn", hurtLoc)
            dim.playSound("artefact.buzzy_nest.spawn", hurtLoc)
        })
    }

});