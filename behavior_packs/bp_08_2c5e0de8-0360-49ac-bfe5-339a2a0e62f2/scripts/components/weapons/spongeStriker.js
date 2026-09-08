import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:sponge_striker', {
        onHitEntity(e) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (!attacker.isValid || !hit.isValid) return;
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
    const strikerComp = heldItem.getComponent("dungeons:sponge_striker")
    if (strikerComp == undefined) return;
    //effect code
    if (e.damage <= 0) return;
    var damageBoost = heldItem.getDynamicProperty("dungeons:sponge_damage")
    if (!damageBoost) damageBoost = 0
    if (damageBoost > 0) {
        e.damage = e.damage * (1 + (damageBoost / Math.round(1 + e.damage)))
        system.run(() => {
            heldItem.setDynamicProperty("dungeons:sponge_damage", null)
            const lore = heldItem.getLore()
            var stringIndex = undefined
            for (let i = 0; i < lore.length; i++) {
                const string = lore[i]
                if (string.includes("§s§p§n§g§r§8")) {
                    stringIndex = i
                    break;
                }
            }
            if (stringIndex == undefined) {
                const newLoreArray = []
                for (const string of lore) {
                    newLoreArray.push(string)
                }
                newLoreArray.push("§s§p§n§g§r§8" + `+${0} Damage`)
                heldItem.setLore(newLoreArray)
            } else {
                const newLoreArray = []
                for (let i = 0; i < lore.length; i++) {
                    const string = lore[i]
                    if (i !== stringIndex) {
                        newLoreArray.push(string)
                    }
                }
                newLoreArray.push("§s§p§n§g§r§8" + `+${0} Damage`)
                heldItem.setLore(newLoreArray)
            }


            attacker.getComponent("equippable").setEquipment("Mainhand", heldItem)

            const dim = attacker.dimension
            const loc = hurt.location;
            dim.playSound('weapon.enchant.sponge_striker', loc, { volume: (damageBoost / 25) });
            for (let i = 0; i < damageBoost; i++) {
                dim.spawnParticle('dungeons:sponge_striker', loc);
            }
        })
    }
});

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const inventory = hurt.getComponent("inventory")
    if (!inventory) return;
    const container = inventory.container;
    if (!container) return;
    var foundSpongeStrikerIndex = undefined
    for (let i = 0; i < container.size; i++) {
        if (container.getSlot(i).hasItem() == false) continue;
        const item = container.getItem(i)
        if (item.typeId == "dungeons:sponge_striker") {
            foundSpongeStrikerIndex = i
            break;
        }
    }
    if (foundSpongeStrikerIndex == undefined) return;
    const item = container.getItem(foundSpongeStrikerIndex)
    var baseDmg = e.damage
    if (baseDmg < 10) baseDmg = baseDmg * 1.2
    const damage = Math.round(baseDmg * 10) / 10


    var damageBoost = item.getDynamicProperty("dungeons:sponge_damage")
    if (!damageBoost) damageBoost = 0
    damageBoost += 1
    if (damageBoost + damage <= 100) {
        item.setDynamicProperty("dungeons:sponge_damage", damageBoost + damage)
    } else if (damageBoost + damage > 100) {
        item.setDynamicProperty("dungeons:sponge_damage", 100)
    }
    const lore = item.getLore()
    var stringIndex = undefined
    for (let i = 0; i < lore.length; i++) {
        const string = lore[i]
        if (string.includes("§s§p§n§g§r§8")) {
            stringIndex = i
            break;
        }
    }
    if (stringIndex == undefined) {
        const newLoreArray = []
        for (const string of lore) {
            newLoreArray.push(string)
        }
        newLoreArray.push("§s§p§n§g§r§8" + `+${item.getDynamicProperty("dungeons:sponge_damage")} Damage`)
        item.setLore(newLoreArray)
    } else {
        const newLoreArray = []
        for (let i = 0; i < lore.length; i++) {
            const string = lore[i]
            if (i !== stringIndex) {
                newLoreArray.push(string)
            }
        }
        newLoreArray.push("§s§p§n§g§r§8" + `+${item.getDynamicProperty("dungeons:sponge_damage")} Damage`)
        item.setLore(newLoreArray)
    }
    world.gameRules.showTags = false
    container.getSlot(foundSpongeStrikerIndex).setItem(item)
})