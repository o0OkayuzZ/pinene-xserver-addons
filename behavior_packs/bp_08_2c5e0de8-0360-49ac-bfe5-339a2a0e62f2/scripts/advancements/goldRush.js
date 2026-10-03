import { world, system } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

system.runInterval(() => {
    if(!advancementsEnabled) return;
    for(const player of world.getPlayers({excludeTags:["adv:dungeons:gold_rush"]})) {
        const equippable = player.getComponent("equippable")
        const slots = [
            "Head",
            "Chest",
            "Legs",
            "Feet"
        ]
        var passed = true
        for(const slot of slots) {
            const item = equippable.getEquipment(slot)
            if(item && (item.hasTag("dungeons:unique_item") || item.hasTag("dungeons:seasonal_item"))) {
                var passe2 = false
                for (const propertyId of item.getDynamicPropertyIds()) {
                        if (propertyId.includes("dungeons:gild_")) passe2 = true
                }
                if(passe2 == false) passed = false
            } else {
                passed = false
            }
        }
        if(passed) {
            grantAdvancement(player, "dungeons:gold_rush")
        }
    }
})