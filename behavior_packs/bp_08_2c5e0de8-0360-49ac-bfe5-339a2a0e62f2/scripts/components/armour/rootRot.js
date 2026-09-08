import {
    world
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

// TURTLE ARMOUR
world.afterEvents.entityHealthChanged.subscribe((event) => {
    const player = event.entity;
    const oldValue = event.oldValue;
    var newValue = event.newValue;
    if (!player) return;
    if (!player.isValid) return;
    if (player.typeId !== "minecraft:player") return;
    if (!isWearingSet(player, "dungeons:root_rot_armour")) return;
    if (newValue <= oldValue) {
        return;
    }
    const hp = player.getComponent("health")
    if (newValue > hp.defaultValue) newValue = hp.defaultValue
    const diff = newValue - oldValue
    if (diff == 0) return;
    var ticksReduceBy = Math.floor(diff * 20)
    if (ticksReduceBy > 50) ticksReduceBy = 50
    const inventory = player.getComponent("inventory")
    const container = inventory.container;
    for (let i = 0; i < container.size; i++) {
        const slot = container.getSlot(i)
        if (slot.isValid == false) continue;
        const itemStack = slot.getItem()
        if (itemStack == undefined) continue;
        if (!itemStack.getComponent("dungeons:artefact_cooldown")) continue;
        const cd = itemStack.getComponent("cooldown")
        if (!cd) continue;
        if (itemStack.typeId.includes("spinblade")) continue;
        const remainingTime = player.getItemCooldown(cd.cooldownCategory)
        if (remainingTime <= 10) continue;
        var newTime = Math.ceil(remainingTime - ticksReduceBy)
        if (newTime < 10) newTime = 10
        player.startItemCooldown(cd.cooldownCategory, newTime)
    }
});