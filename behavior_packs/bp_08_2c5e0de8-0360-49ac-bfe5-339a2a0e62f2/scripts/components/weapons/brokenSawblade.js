import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage, getDirection, makeVector } from "main.js";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:broken_sawblade', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;
            if (attacker.typeId !== "minecraft:player") return;
            const cd = e.itemStack.getComponent("cooldown")
            if (cd.getCooldownTicksRemaining(attacker) == 0) {
                const item = e.itemStack
                const heatLvl = item.getDynamicProperty("dungeons:sawblade_heat")
                if (!heatLvl) {
                    item.setDynamicProperty("dungeons:sawblade_heat", 1)
                } else if (heatLvl < 25) {
                    item.setDynamicProperty("dungeons:sawblade_heat", heatLvl + 1)
                }
                const lore = item.getLore()
                var stringIndex = undefined
                for (let i = 0; i < lore.length; i++) {
                    const string = lore[i]
                    if (string.includes("§h§e§a§t§r§8")) {
                        stringIndex = i
                        break;
                    }
                }
                if (stringIndex == undefined) {
                    const newLoreArray = []
                    for (const string of lore) {
                        newLoreArray.push(string)
                    }
                    newLoreArray.push("§h§e§a§t§r§8" + `+${item.getDynamicProperty("dungeons:sawblade_heat")} Damage`)
                    item.setLore(newLoreArray)
                } else {
                    const newLoreArray = []
                    for (let i = 0; i < lore.length; i++) {
                        const string = lore[i]
                        if (i !== stringIndex) {
                            newLoreArray.push(string)
                        }
                    }
                    newLoreArray.push("§h§e§a§t§r§8" + `+${item.getDynamicProperty("dungeons:sawblade_heat")} Damage`)
                    item.setLore(newLoreArray)
                }
                world.gameRules.showTags = false
                attacker.getComponent("equippable").setEquipment("Mainhand", item)
            }
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
    const sawbladeComp = heldItem.getComponent("dungeons:broken_sawblade")
    if (sawbladeComp == undefined) return;
    const unique = sawbladeComp.customComponentParameters.params.unique;
    //effect code
    if (e.damage <= 0) return;
    var heatLvl = heldItem.getDynamicProperty("dungeons:sawblade_heat")
    if (!heatLvl) heatLvl = 0
    const rand = Math.random()
    var margin = 35
    if (unique == true) margin = 50
    if (heatLvl / margin > rand && heatLvl > margin / 10) {
        e.damage = e.damage / 2
        system.runTimeout(() => {
            const cd = heldItem.getComponent("cooldown")
            attacker.startItemCooldown(cd.cooldownCategory, 120 + heatLvl * 2)
            heldItem.setDynamicProperty("dungeons:sawblade_heat", null)

            const lore = heldItem.getLore()
            var stringIndex = undefined
            for (let i = 0; i < lore.length; i++) {
                const string = lore[i]
                if (string.includes("§h§e§a§t§r§8")) {
                    stringIndex = i
                    break;
                }
            }
            if (stringIndex == undefined) {
                const newLoreArray = []
                for (const string of lore) {
                    newLoreArray.push(string)
                }
                newLoreArray.push("§h§e§a§t§r§8" + `+${0} Damage`)
                heldItem.setLore(newLoreArray)
            } else {
                const newLoreArray = []
                for (let i = 0; i < lore.length; i++) {
                    const string = lore[i]
                    if (i !== stringIndex) {
                        newLoreArray.push(string)
                    }
                }
                newLoreArray.push("§h§e§a§t§r§8" + `+${0} Damage`)
                heldItem.setLore(newLoreArray)
            }


            attacker.getComponent("equippable").setEquipment("Mainhand", heldItem)

            const dim = attacker.dimension
            const loc = hurt.location;
            if (unique == true) {
                dim.spawnParticle('dungeons:sawblade_smoke_unique', loc);
                dim.playSound('weapon.sawblade.break.unique', loc);
            } else {
                dim.spawnParticle('dungeons:sawblade_smoke', loc);
                dim.playSound('weapon.sawblade.break.common', loc);
            }

        }, 1)
    } else {
        e.damage = e.damage * (1 + (heatLvl / Math.round(1 + e.damage)))
        system.run(() => {
            const cd = heldItem.getComponent("cooldown")
            attacker.startItemCooldown(cd.cooldownCategory, 0)

            const dim = attacker.dimension
            const loc = attacker.location;

            if (unique == false) dim.playSound('weapon.sawblade.hit.common', loc, { volume: 0.3 + heatLvl / 15, pitch: 0.75 + heatLvl / 30 });
            if (unique == true) dim.playSound('weapon.sawblade.hit.unique', loc, { volume: 0.3 + heatLvl / 15, pitch: 0.75 + heatLvl / 30 });
            for (let i = 0; i < heatLvl; i++) {
                hurt.dimension.spawnParticle(heldItem.typeId, hurt.location);
            }
        })
    }
});