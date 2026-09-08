import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:prospector"



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

    if (!hurt.matches({ families: ["player"] }) && !hurt.matches({ families: ["monster"] })) return;

    hurt.dimension.spawnParticle('dungeons:emerald', hurt.location)
    attacker.playSound('artefact.shadow_break',
        {
            pitch: 1.5,
            volume: 0.3
        });
    let hp = hurt.getComponent('minecraft:health')
    var expAdded = hp.defaultValue * 0.2
    for (let i = 0; i < Math.floor(hp.defaultValue * 0.8); i++) {
        if (Math.random() > 0.5) expAdded += 1
    }
    expAdded = Math.round(expAdded)
    const increments = Math.floor(1 + expAdded / 20)
    var delay = 0
    for (let i = 0; i < expAdded; i += increments) {
        system.runTimeout(() => {
            attacker.addExperience(increments)
        }, delay)
        delay += 1
        if (i > expAdded * 0.6) delay += 1
        if (i > expAdded * 0.9) delay += 1
    }
});