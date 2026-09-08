import {
    world,
    system,
    EnchantmentType
} from "@minecraft/server";

import { arrowTypes, playShootSound } from "components/ranged.js"


world.afterEvents.itemStartUse.subscribe((e) => {
    var item = e.itemStack;
    const player = e.source;
    if (!item) return;
    if (item.hasTag("dungeons:crossbow")) {
        var state = item.getDynamicProperty("dungeons:loaded")
        if (state == true) return;
        playDrawSound(player, e.useDuration)
        const enchantable = item.getComponent("enchantable")
        if (enchantable !== undefined) {
            const quickCharge = enchantable.getEnchantment("minecraft:quick_charge")
            if (quickCharge !== undefined) {
                enchantable.removeEnchantment(new EnchantmentType("minecraft:quick_charge"))
                const equippable = player.getComponent("equippable")
                equippable.setEquipment("Mainhand", item)
                player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.cannot_use_quick_charge" }])
                return;
            }
        }
    }
})

world.afterEvents.itemStopUse.subscribe((e) => {
    var item = e.itemStack;
    const player = e.source;
    if (!item) return;
    if (item.hasTag("dungeons:crossbow")) {
        const enchantable = item.getComponent("enchantable")
        if (enchantable !== undefined) {
            const quickCharge = enchantable.getEnchantment("minecraft:quick_charge")
            if (quickCharge !== undefined) {
                enchantable.removeEnchantment(new EnchantmentType("minecraft:quick_charge"))
                const equippable = player.getComponent("equippable")
                equippable.setEquipment("Mainhand", item)
                player.sendMessage([{ text: "§7§o" }, { translate: "dungeons.warn.cannot_use_quick_charge" }])
                return;
            }
        }
        var arrowFound
        const arrowNear = player.dimension.getEntities({ location: player.location, maxDistance: 48, excludeTags: ["dungeons:crossbow_checked"] })
        for (const arrowPoss of arrowNear) {
            if (arrowTypes.includes(arrowPoss.typeId)) {
                const proj = arrowPoss.getComponent("projectile")
                if (!proj) continue;
                const owner = proj.owner;
                if (!owner) continue;
                if (owner == player) arrowFound = arrowPoss
            } else continue;
        }
        if (!arrowFound && e.useDuration > 0) return;
        if (arrowFound) {
            arrowFound.addTag("dungeons:crossbow_checked")
        }
        system.run(() => {
            const equippable = player.getComponent("equippable")
            var held = equippable.getEquipment("Mainhand")
            var state = held.getDynamicProperty("dungeons:loaded")
            if (held.typeId !== e.itemStack.typeId) return;
            if (state == null) {
                state = false
            }
            if (state == true && arrowFound !== undefined) {
                held.setDynamicProperty("dungeons:loaded", false)
            }
            if (state == false) {
                held.setDynamicProperty("dungeons:loaded", true)
            }
            equippable.setEquipment("Mainhand", held)
        })
    }
})

