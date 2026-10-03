import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { grantPlayerSoul } from "misc/soulManager.js"
import { isWearingSet } from "components/armour.js"
import {getSoulBarText} from "misc/soulManager.js"

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
    var count = 0
    if (heldItem.hasTag(effectId)) count += 1
    if (heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) count += 1
    if (count == 0) return;
    for (let i = 0; i < count; i++) {
        //effect code
        if (hurt.typeId == "dungeons:target_dummy") return;
        if (e.damage <= 0) return;
        const odds = Math.random()
        if (odds > 0.2) return; ``
        system.run(() => {

            var soulsGenerated = 0
            for (let i = 0; i < 5; i++) {
                if (Math.floor(Math.random() * 2) == 1) soulsGenerated += 1
            }
            if (isWearingSet(attacker, "dungeons:verdant_robes")) soulsGenerated += soulsGenerated

            var max = 100
            if (isWearingSet(attacker, "dungeons:bag_o_souls")) max = 200
            if (isWearingSet(attacker, "dungeons:verdant_robes")) soulsGenerated += soulsGenerated
            if (world.scoreboard.getObjective('soulGauge').getScore(attacker) + soulsGenerated > max) {
                soulsGenerated = max - world.scoreboard.getObjective('soulGauge').getScore(attacker)
            }
            if (soulsGenerated < 1) return;
            for (let i = 0; i < soulsGenerated; i++) {
                system.runTimeout(() => {

                    grantPlayerSoul(hurt, attacker)
                    attacker.onScreenDisplay.setActionBar(getSoulBarText(attacker, true))
                }, i)
            }
            system.runTimeout(() => {

                attacker.onScreenDisplay.setActionBar(getSoulBarText(attacker, false))
            }, soulsGenerated + 1)
            const loc = attacker.location;
            const dim = attacker.dimension;
            dim.spawnParticle("dungeons:soul_siphon_rings", loc)
            dim.playSound("random.orb", loc, { volume: 0.6 })
            dim.playSound("mob.evocation_illager.cast_spell", loc, { volume: 0.7, pitch: 2 })
        })
    }
});