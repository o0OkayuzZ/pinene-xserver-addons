export function isWearingSet(player, tag) {
    const equippable = player.getComponent("equippable")
    if (!equippable) return false
    const head = equippable.getEquipment("Head")
    const chest = equippable.getEquipment("Chest")
    const legs = equippable.getEquipment("Legs")
    const feet = equippable.getEquipment("Feet")
    if (!head || !(head.hasTag(tag) || head.getDynamicProperty("dungeons:gild") == tag)) return false
    if (!chest || !(chest.hasTag(tag) || chest.getDynamicProperty("dungeons:gild") == tag)) return false
    if (!legs || !(legs.hasTag(tag) || legs.getDynamicProperty("dungeons:gild") == tag)) return false
    if (!feet || !(feet.hasTag(tag) || feet.getDynamicProperty("dungeons:gild") == tag)) return false
    return true;
}



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
import "./armour/frost.js";

import "./armour/plate.js";
import "./armour/fullMetal.js";
import "./armour/cauldron.js";

//the evocation armour cooldown effect is handeled in the artefactCooldown.js file
//verdant armour soul effect handeled in soul.js file
import "./armour/emberRobes.js";

import "./armour/ocelot.js";
import "./armour/shadowWalker.js";

import "./armour/rootRot.js";
import "./armour/blackSpot.js";

import "./armour/emerald.js";
import "./armour/opulent.js";
import "./armour/gildedGlory.js";

import "./armour/turtle.js";
import "./armour/nimbleTurtle.js";

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
import "./armour/frostBite.js";

import "./armour/beenest.js";
import "./armour/beehive.js";

//the soul effect of soul armours is in soul file
//soulrobe armour is handled in the specialDamage function of main.js
import "./armour/souldancer.js";