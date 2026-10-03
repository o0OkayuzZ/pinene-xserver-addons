import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:refreshment"



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
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    system.runTimeout(() => {
        const dim = hurt.dimension

        var sound = false
        const inventory = attacker.getComponent("inventory")
        if (!inventory) return;
        var cooldowns = []
        const container = inventory.container;
        for (let i = 0; i < container.size; i++) {
            const itemCheck = container.getItem(i)
            if (!itemCheck) continue;
            if (itemCheck.getComponent("dungeons:artefact_cooldown") == false) continue;
            const cooldown = itemCheck.getComponent("cooldown")
            if (!cooldown) continue;
            if (!cooldowns.includes(cooldown.cooldownCategory)) cooldowns.push(cooldown.cooldownCategory)
        }
        for (let i = 0; i < cooldowns.length; i++) {
            const cooldown = attacker.getItemCooldown(cooldowns[i])
            if (cooldowns[i].includes("spinblade")) continue;
            if (cooldown == 0) continue;
            var newCd = cooldown - 20
            if (newCd <= 0) newCd = 1
            attacker.startItemCooldown(cooldowns[i], newCd)
            sound = true
        }

        if (sound) dim.playSound("artefact.swiftness_boot.use", attacker.location, { pitch: 2.5 })
    }, 18)

});