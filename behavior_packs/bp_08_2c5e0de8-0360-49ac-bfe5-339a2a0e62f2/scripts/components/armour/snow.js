import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:snow_armour")) return;
    if (e.damageSource.cause !== EntityDamageCause.freezing) return;
    const baseDmg = e.damage;
    if (!baseDmg) return;
    if (baseDmg <= 0) return;
    e.damage = e.damage * 0.5
    if (hurt.getDynamicProperty("dungeons:damage_reduction_prevented") >= baseDmg) {
        e.cancel = true;
        return;
    }
    hurt.setDynamicProperty("dungeons:damage_reduction_prevented", baseDmg)
    system.runTimeout(() => {
        hurt.setDynamicProperty("dungeons:damage_reduction_prevented", null)
    }, 9)
});


const effectArray = [
    "Slowness"
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
    if (!isWearingSet(entity, "dungeons:snow_armour")) return;
    const type = e.effectType;
    const testType = removeNumerals(type)
    if (effectArray.includes(testType)) e.duration = e.duration * 1 / 3
});
