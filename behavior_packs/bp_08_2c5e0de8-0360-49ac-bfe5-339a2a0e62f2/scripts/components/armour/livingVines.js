import {
    world
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
world.afterEvents.entityHurt.subscribe((event) => {
    const damaged = event.hurtEntity;
    const cause = event.damageSource.cause;
    if (event.damage > 4 || (cause != "magic" && cause != "wither")) {
        return;
    }
    var damage = event.damage;
    if (damage > 2) damage = 2
    if (damaged.getEffect('poison') || damaged.getEffect('fatal_poison')) {
        const players = damaged.dimension.getPlayers({ excludeGameModes: ['Creative', "Spectator"], maxDistance: 10, location: damaged.location });
        var livingVines = []
        for (const player of players) {
            if (!isWearingSet(player, "dungeons:living_vines_armour")) continue;
            livingVines.push(player)
        }
        for (const player of livingVines) {
            let hp = player.getComponent('minecraft:health');
            if (hp.currentValue < hp.defaultValue) {
                var healing = (damage / 2.5) / players.length;
                if (healing > 1.5) healing = 1.5
                if (hp.currentValue + healing > hp.defaultValue) {
                    hp.setCurrentValue(hp.defaultValue)
                } else {
                    hp.setCurrentValue(hp.currentValue + healing)
                }
            }
        }
    }
});