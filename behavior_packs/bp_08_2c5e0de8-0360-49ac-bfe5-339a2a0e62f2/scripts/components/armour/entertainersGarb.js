import {
    world,
    system,
} from "@minecraft/server";

const effectArray = [
    "Speed",
    "Haste",
    "Strength",
    "Jump Boost",
    "Regeneration",
    "Resistance",
    "Fire Resistance",
    "Water Breathing",
    "Invisibility",
    "Night Vision",
    "Health Boost",
    "Absorption",
    "Slow Falling",
    "Conduit Power",
    "Village Hero"
];

import { isWearingSet } from "components/armour.js"

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
    if (!isWearingSet(entity, "dungeons:entertainers_garb")) return;
    const type = e.effectType;
    const testType = removeNumerals(type)
    if (effectArray.includes(testType)) e.duration = e.duration * 1.4
});
