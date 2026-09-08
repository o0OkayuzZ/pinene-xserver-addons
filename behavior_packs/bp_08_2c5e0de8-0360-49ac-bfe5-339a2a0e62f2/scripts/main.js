import {
    world
} from "@minecraft/server";

import { isWearingSet } from "./components/armour.js"

//vector bullshit the original
export function getDirection(from, to) {
    const distance = Math.hypot(from.x - to.x, from.y - to.y, from.z - to.z);
    if (distance == 0) return { x: 0, y: 0, z: 0 };

    return {
        x: (to.x - from.x) / distance,
        y: (to.y - from.y) / distance,
        z: (to.z - from.z) / distance
    };
}
//vector bullshit the second original
export function makeVector(vector, strength) {
    var vx = vector.x
    var vz = vector.z

    return { x: vx * strength, z: vz * strength }
}
//gravity
export function gravityTo(target, pullLoc) {
    const xDif = pullLoc.x - target.location.x;
    const zDif = pullLoc.z - target.location.z;
    var xDif2 = 0;
    var zDif2 = 0;
    if (xDif < 0) {
        xDif2 = xDif * -1
    }
    if (xDif >= 0) {
        xDif2 = xDif
    }
    if (zDif < 0) {
        zDif2 = zDif * -1
    }
    if (zDif >= 0) {
        zDif2 = zDif
    }
    const dir = getDirection(target.location, pullLoc)
    target.applyKnockback(makeVector(dir, (xDif2 + zDif2) / 2.1), 0.3);
}
//applies special damage
export function specialDamage(attacker, target, damage, cause, properties, projectile) {
    if (!properties) properties = []
    for (const property of properties) {
        if (property == "apply_strength") damage = applyStrength(damage, attacker)
        if (property == "apply_weakness") damage = applyWeakness(damage, attacker)
        if (property == "apply_melee_enchants") damage = applyMeleeEnchants(damage, attacker, target)
        if (property == "artefact") {
            if (isWearingSet(attacker, "dungeons:piglin_armour")) damage = damage * 1.5
            if (isWearingSet(attacker, "dungeons:guard_armour")) damage = damage * 1.2
            if (isWearingSet(attacker, "dungeons:soulrobe_armour")) damage = damage * 1.3
        }
    }
    if (damage == undefined) return false;
    if (projectile == undefined) return target.applyDamage(damage, { cause: cause, damagingEntity: attacker })
    if (projectile == undefined) return target.applyDamage(damage, { cause: cause, damagingEntity: attacker, damagingProjectile: projectile })
}

function applyWeakness(damageValue, attacker) {
    if (attacker.getEffect('weakness')) {
        const weakness = attacker.getEffect('weakness').amplifier + 1;
        return damageValue * Math.pow(0.8, weakness) + ((Math.pow(0.8, weakness) - 1) / 0.4);
    } else {
        return damageValue
    }
}
function applyStrength(damageValue, attacker) {
    if (attacker.getEffect('strength')) {
        const strength = attacker.getEffect('strength').amplifier + 1;
        return damageValue * Math.pow(1.3, strength) + ((Math.pow(1.3, strength) - 1) / 0.3);
    } else {
        return damageValue
    }
}
function applyMeleeEnchants(damageValue, attacker, target) {
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return damageValue
    const weapon = equippable.getEquipment("Mainhand")
    if (!weapon) return damageValue;
    const enchantable = weapon.getComponent('minecraft:enchantable');
    if (!enchantable) return damageValue;
    for (const enchantment of enchantable.getEnchantments()) {
        if (enchantment.type.id === 'sharpness') {
            damageValue = damageValue + Math.floor(enchantment.level * 1.25);
        }
        if (enchantment.type.id === 'smite') {
            if (target.matches({
                families: ['undead']
            })) {
                damageValue = damageValue + Math.floor(enchantment.level * 2.5);
            }
        }
        if (enchantment.type.id === 'bane_of_arthropods') {
            if (target.matches({
                families: ['arthropod']
            })) {
                damageValue = damageValue + Math.floor(enchantment.level * 2.5);
            }
        }
    }
    return damageValue
}
//checks if a mob is a valid target
export function isValidTarget(target) {
    if (target.isValid == false) return false;
    if (target.typeId == "minecraft:player" && target.getGameMode() == "Creative") return false
    if ((target.matches({ families: ["monster"] }) || target.matches({ families: ["target_dummy"] }) || target.matches({ families: ["mob"] }) || target.matches({ families: ["animal"] }) || (target.matches({ families: ["player"] }) && world.gameRules.pvp == true))) {
        return true;
    }
    return false;
}


//import "./misc.js";
//import "./misc2.js";



import "./worldInitialise.js";


import "./components/artefacts.js";
import "./components/weapons.js";
import "./components/armour.js";
import "./components/blocks.js";
import "./components/ranged.js";
import "./components/other.js";

import "./gildedTest.js";


import "./misc/debug.js";
import "./misc/shadowForm.js";
import "./misc/voidedEffect.js";
import "./misc/itemDescriptions.js";
import "./misc/swingAnimations.js";
import "./misc/holdAnimation.js";
import "./misc/bossManager.js";
import "./misc/artefactHud.js";
import "./misc/soulManager.js";
import "./misc/armourEquipSound.js";
import "./misc/totemBehaviour.js";
import "./misc/itemGlow.js";
import "./misc/bookOfHeroesCollection.js";
import "./misc/sparklerLoot.js";

import "./misc/entityBehaviour.js";

import "./misc/customcommands/setSouls.js";
import "./misc/customcommands/showCooldownTimers.js";
import "./misc/customcommands/bookOfHeroesCmds.js";