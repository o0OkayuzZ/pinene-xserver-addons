import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:radiance"

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
    const critical = Math.floor(Math.random() * 4);
    if (critical == 1) {
        system.run(() => {
            const dmg = e.damage;
            var amountHealed = e.damage * 0.15
            const dim = attacker.dimension
            const loc = attacker.location;
            dim.spawnParticle("dungeons:radiance_aura", loc)
            dim.spawnParticle("dungeons:radiance_aura2", loc)
            const targets = dim.getEntities({ location: loc, maxDistance: 4 })
            for (const target of targets) {
                var heal = false;
                if (!target || !target.isValid) continue;
                if (target == attacker) heal = true;
                const tameable = target.getComponent("tameable")
                if (tameable) {
                    const owner = tameable.tamedToPlayer;
                    if (owner == attacker) heal = true
                }
                if (heal == true) {
                    let hp = target.getComponent("health")
                    const maxHeal = 5
                    const minHeal = 1

                    const maxHP = hp.defaultValue
                    const currentHP = hp.currentValue;
                    if (amountHealed > maxHeal) amountHealed = maxHeal
                    if (amountHealed < minHeal) amountHealed = minHeal
                    if ((amountHealed + currentHP) > maxHP) {
                        hp.setCurrentValue(maxHP)
                    } else {
                        hp.setCurrentValue(currentHP + amountHealed)
                    }
                }
            }
        })
    }

});