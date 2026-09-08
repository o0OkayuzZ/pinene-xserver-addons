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
    if (!isWearingSet(player, "dungeons:black_spot_armour")) return;
    if (newValue <= oldValue) {
        return;
    }
    const hp = player.getComponent("health")
    if (newValue > hp.defaultValue) newValue = hp.defaultValue
    const diff = newValue - oldValue
    if (diff == 0) return;
    const hunger = player.getComponent("minecraft:player.hunger")
    if (!hunger) return;
    var healAmt = diff / 2
    if (healAmt > 5) healAmt = 5
    const max = hunger.defaultValue
    const current = hunger.currentValue;
    if (current == max) return;

    if (healAmt + current > max) {
        hunger.setCurrentValue(max)
    } else {
        hunger.setCurrentValue(current + healAmt)
    }

    if (healAmt > 1) player.dimension.playSound('random.eat', player.location, { volume: 0.4, pitch: 1.2 });
});