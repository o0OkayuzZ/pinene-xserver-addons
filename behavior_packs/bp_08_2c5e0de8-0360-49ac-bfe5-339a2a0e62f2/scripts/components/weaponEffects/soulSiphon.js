import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { grantPlayerSoul } from "misc/soulManager.js"
import { isWearingSet } from "components/armour.js"

const effectId = "dungeons:soul_siphon"

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
    if (hurt.typeId == "dungeons:target_dummy") return;
    if (e.damage <= 0) return;
    const odds = Math.random()
    if (odds > 0.2) return;
    system.run(() => {

        var soulsGenerated = 0
        for (let i = 0; i < 5; i++) {
            if (Math.floor(Math.random() * 2) == 1) soulsGenerated += 1
        }
        if (isWearingSet(attacker, "dungeons:verdant_robes")) soulsGenerated += soulsGenerated
        if (world.scoreboard.getObjective('soulGauge').getScore(attacker) + soulsGenerated > 100) {
            soulsGenerated = 100 - world.scoreboard.getObjective('soulGauge').getScore(attacker)
        }
        if (soulsGenerated < 1) return;
        for (let i = 0; i < soulsGenerated; i++) {
            system.runTimeout(() => {

                grantPlayerSoul(hurt, attacker)
                attacker.onScreenDisplay.setActionBar(`§s${world.scoreboard.getObjective('soulGauge').getScore(attacker)}§s ソウル `)
            }, i)
        }
        system.runTimeout(() => {

            attacker.onScreenDisplay.setActionBar(`§b${world.scoreboard.getObjective('soulGauge').getScore(attacker)}§s ソウル `)
        }, soulsGenerated + 1)
        const loc = attacker.location;
        const dim = attacker.dimension;
        dim.spawnParticle("dungeons:soul_siphon_rings", loc)
        dim.playSound("random.orb", loc, { volume: 0.6 })
        dim.playSound("mob.evocation_illager.cast_spell", loc, { volume: 0.7, pitch: 2 })
    })
});