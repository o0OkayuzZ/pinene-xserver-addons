import {
    world,
    system
} from "@minecraft/server";


import { isWearingSet } from "components/armour.js"

const effectArray = [
    "Slowness",
    "Mining Fatigue",
    "Nausea",
    "Blindness",
    "Hunger",
    "Weakness",
    "Poison",
    "Wither",
    "Levitation",
    "Fatal Poison",
    "Bad Omen",
    "Darkness",
    "Trial Omen",
    "Raid Omen",
    "Oozing",
    "Wind Charged",
    "Infested",
    "Weaving"
];

function removeNumerals(type) {
    const split = type.split(" ")
    var newString = ""
    for (let i = 0; i < split.length; i++) {
        if (split[i] !== "V" && split[i] !== "VI" && split[i] !== "IV" && split[i] !== "III" && split[i] !== "II" && split[i] !== "I") {
            newString += split[i] + " "
        }
    }
    newString = newString.trimEnd()
    return newString
}

world.beforeEvents.effectAdd.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (entity.typeId !== "minecraft:player") return;
    if (!isWearingSet(entity, "dungeons:troubadour")) return;
    const type = e.effectType;
    const testType = removeNumerals(type)
    if (effectArray.includes(testType)) e.duration = e.duration * 0.6
});


system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:troubadour") == false) continue;
        player.dimension.spawnParticle('dungeons:troubadour', player.location)
    }
}, 30)