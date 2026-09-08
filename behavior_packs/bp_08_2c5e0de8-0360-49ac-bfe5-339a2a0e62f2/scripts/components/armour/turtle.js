import {
    world,
    system
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"

world.beforeEvents.entityHeal.subscribe((e) => {
    const player = e.healedEntity;
    if (player.typeId !== 'minecraft:player') {
        return;
    }
    if (isWearingSet(player, "dungeons:turtle_armour")) {
        e.healing = e.healing * 1.3
    }
});