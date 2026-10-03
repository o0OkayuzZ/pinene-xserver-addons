export function isWearingSet(player, tag) {
    const equippable = player.getComponent("equippable")
    if (!equippable) return false
    const head = equippable.getEquipment("Head")
    const chest = equippable.getEquipment("Chest")
    const legs = equippable.getEquipment("Legs")
    const feet = equippable.getEquipment("Feet")
    if (!head || !(head.hasTag(tag) || head.getDynamicProperty(tag.replace("dungeons:", "dungeons:gild_")))) return false
    if (!chest || !(chest.hasTag(tag) || chest.getDynamicProperty(tag.replace("dungeons:", "dungeons:gild_")))) return false
    if (!legs || !(legs.hasTag(tag) || legs.getDynamicProperty(tag.replace("dungeons:", "dungeons:gild_")))) return false
    if (!feet || !(feet.hasTag(tag) || feet.getDynamicProperty(tag.replace("dungeons:", "dungeons:gild_")))) return false
    return true;
}
export function isWearingMysteryArmour(player, tag) {
    const equippable = player.getComponent("equippable")
    if (!equippable) return false
    const head = equippable.getEquipment("Head")
    const chest = equippable.getEquipment("Chest")
    const legs = equippable.getEquipment("Legs")
    const feet = equippable.getEquipment("Feet")
    if (!head || !head.typeId.includes("dungeons:mystery_") || !(head.getDynamicProperty("dungeons:mystery_effect_0") == tag || head.getDynamicProperty("dungeons:mystery_effect_1") == tag || head.getDynamicProperty("dungeons:mystery_effect_2") == tag)) return false
    if (!chest || !chest.typeId.includes("dungeons:mystery_") || !(chest.getDynamicProperty("dungeons:mystery_effect_0") == tag || chest.getDynamicProperty("dungeons:mystery_effect_1") == tag || chest.getDynamicProperty("dungeons:mystery_effect_2") == tag)) return false
    if (!legs || !legs.typeId.includes("dungeons:mystery_") || !(legs.getDynamicProperty("dungeons:mystery_effect_0") == tag || legs.getDynamicProperty("dungeons:mystery_effect_1") == tag || legs.getDynamicProperty("dungeons:mystery_effect_2") == tag)) return false
    if (!feet || !feet.typeId.includes("dungeons:mystery_") || !(feet.getDynamicProperty("dungeons:mystery_effect_0") == tag || feet.getDynamicProperty("dungeons:mystery_effect_1") == tag || feet.getDynamicProperty("dungeons:mystery_effect_2") == tag)) return false
    return true;
}
import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:toughness', {});
});

const doNotReduce = [
    EntityDamageCause.override,
    EntityDamageCause.selfDestruct,
    EntityDamageCause.sonicBoom,
    EntityDamageCause.fall,
    EntityDamageCause.fireTick,
    EntityDamageCause.suffocation,
    EntityDamageCause.drowning,
    EntityDamageCause.starve,
    EntityDamageCause.flyIntoWall,
    EntityDamageCause.magic,
    EntityDamageCause.void,
    EntityDamageCause.freezing
]

const maxToughnessReduction = 0.80;
const damageScale = 9;
const offset = 7

function customToughness(damage, toughness) {
    const toughnessFactor = toughness / (toughness + offset);
    const damageFactor = damage / (damage + damageScale);
    const toughnessReduction = maxToughnessReduction*toughnessFactor *damageFactor;
    var finalDamage = damage * (1 - (toughnessReduction*1.5))
    return finalDamage;
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if(!hurt || !hurt.isValid || hurt.typeId !== "minecraft:player") return;
    const equippable = hurt.getComponent("equippable")
    if(!equippable) return;
    const cause = e.damageSource.cause
    if(doNotReduce.includes(cause)) return;
    var bonusToughness = 0
    const slots = [
        "Head",
        "Chest",
        "Legs",
        "Feet"
    ]
    for(const slot of slots) {
        const slotItem = equippable.getEquipment(slot)
        if(slotItem) {
            const toughComp = slotItem.getComponent("dungeons:toughness")
            if(toughComp) {
                bonusToughness += toughComp.customComponentParameters.params.toughness
            }
        }
    }
    if(bonusToughness == 0) return;
    const damage = e.damage
    e.damage = customToughness(damage,  bonusToughness)
})










//imports


import "./armour/dark.js";
import "./armour/titansShroud.js";

import "./armour/thief.js";
import "./armour/spider.js";

//grim armour soul effect handeled in soul.js file
import "./armour/grim.js";
import "./armour/wither.js";
import "./armour/spookyGourdian.js";

import "./armour/ghostly.js";
import "./armour/ghostKindler.js";
import "./armour/cloakedSkull.js";

import "./armour/wolf.js";
import "./armour/blackWolf.js";
import "./armour/fox.js";

import "./armour/snow.js";
import "./armourEffects/chilling.js";

import "./armour/plate.js";
import "./armour/fullMetal.js";
import "./armour/cauldron.js";

//the evocation armour cooldown effect is handeled in the artefactCooldown.js file
//verdant armour soul effect handeled in soul.js file
import "./armourEffects/burning.js";

import "./armour/ocelot.js";
import "./armour/shadowWalker.js";

import "./armour/rootRot.js";
import "./armourEffects/foodReserves.js";

import "./armour/emerald.js";
import "./armour/opulent.js";
import "./armour/gildedGlory.js";

import "./armour/turtle.js";
import "./armourEffects/rush.js";

import "./armour/squid.js";
import "./armour/glowSquid.js";

import "./armour/sprout.js";
import "./armour/livingVines.js";

//piglin armour is handled in the specialDamage function of main.js
import "./armour/goldenPiglin.js";

//guard armour is handled in the specialDamage function of main.js and the artefactCooldown js file
import "./armour/ender.js";

import "./armour/entertainersGarb.js";
import "./armour/troubadour.js";

import "./armour/shulker.js";
import "./armour/sturdyShulker.js";

//the soul effect of teleport robes is in soul file
import "./armour/teleportationRobes.js";
import "./armour/unstableRobes.js";

import "./armour/champions.js";
import "./armour/heros.js";

//the soul effect of phantom armours is in soul file
import "./armour/phantom.js";
import "./armourEffects/snowBall.js";

import "./armour/beenest.js";
import "./armour/beehive.js";

//the soul effect of soul armours is in soul file
//soulrobe armour is handled in the specialDamage function of main.js
import "./armour/souldancer.js";

//splendid armour is handled in the specialDamage function of main.js
import "./armour/battle.js";

//cavecrawler armour is handled in the specialDamage function of main.js
import "./armour/spelunkerArmour.js";
import "./armour/sweetTooth.js";

import "./armour/mercenary.js";
import "./armour/renegade.js";
import "./armour/hungryHorror.js";


import "./armour/climbingGear.js";
import "./armour/ruggedClimbingGear.js";
import "./armour/goat.js";

import "./armour/scaleMail.js";

import "./armour/hunters.js";
import "./armour/archers.js";


//gilds

import "./armourEffects/bagOSouls.js";
import "./armourEffects/beastBoss.js";
import "./armourEffects/beastSurge.js";
//cooldown effect handeled in artefacts.js file
import "./armourEffects/cowardice.js";
import "./armourEffects/explorer.js";
import "./armourEffects/finalShout.js";
//fire focus effect is handled in the specialDamage function of main.js
import "./armourEffects/fireTrail.js";
import "./armourEffects/frenzied.js";
import "./armourEffects/gravityPulse.js";
//health synergy effect handeled in artefacts.js file
//lightning focus effect is handled in the specialDamage function of main.js
//luck of the sea is handled in ancient hunt files
import "./armourEffects/luckyExplorer.js";
//poison focus effect is handled in the specialDamage function of main.js
import "./armourEffects/potionBarrier.js";
import "./armourEffects/prospector.js";
import "./armourEffects/protection.js";
import "./armourEffects/reckless.js";
import "./armourEffects/shadowBlast.js";
//the soul effect of shadow surge is in soul file
//soul focus effect is handled in the specialDamage function of main.js
//the soul effect of soul speed is in soul file
//speed synergy effect handeled in artefacts.js file
import "./armourEffects/thorns.js";


//son :crying emoji:
import "./armour/mystery.js";
import "./armourEffects/healAllies.js";