import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

const effectArray = [
    "speed",
    "baste",
    "strength",
    "jump_boost",
    "regeneration",
    "resistance",
    "fire_resistance",
    "water_breathing",
    "invisibility",
    "night_vision",
    "health_boost",
    "absorption",
    "slow_falling",
    "conduit_power",
    "village_hero"
];

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        if (isWearingSet(player, "dungeons:beast_surge")) {
            const effects = player.getEffects()
            var playerSummons = []
            const pets = player.dimension.getEntities({ families: ["artefact", "pet"] })
            for (const pet of pets) {
                const tameable = pet.getComponent("tameable")
                if (!tameable) continue;
                const owner = tameable.tamedToPlayer
                if (!owner || owner !== player) continue;
                playerSummons.push(pet)
            }
            if (playerSummons.length == 0) continue;
            for (const effect of effects) {
                if (effect.isValid && effectArray.includes(effect.typeId.replace("minecraft:", ""))) {
                    for (const pet of playerSummons) {
                        if (!pet.getEffect(effect.typeId)) {
                            try {
                                pet.addEffect(effect.typeId, Math.ceil(effect.duration * 0.8), { amplifier: effect.amplifier })
                            } catch {

                            }
                        }
                    }
                }
            }
        }
    }
})