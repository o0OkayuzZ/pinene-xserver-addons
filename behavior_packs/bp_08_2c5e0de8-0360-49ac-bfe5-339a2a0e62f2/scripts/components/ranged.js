import {
    world,
    system
} from "@minecraft/server";

export const arrowTypes = [
    "minecraft:arrow",
    "dungeons:harpoon_arrow",
    "dungeons:burning_arrow",
    "dungeons:thundering_arrow",
    "dungeons:torment_arrow",
    "dungeons:firework_arrow"
]

import { crossbowFired } from "./ranged/crossbowLoading.js"

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:shooter_sound', {
        onCompleteUse(event) {
            //i found out after making the whole loading system that this is a WAYYYY better way of detecting succesful crossbow loading, fuck me
            //if this comment is still here, that means i could not be bothered to recode this system for a third time in one week
            //eughhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh im so tired of these BOWS
        }
    });
});

export function playShootSound(player, sound) {
    const hd = player.getHeadLocation();
    const vd = player.getViewDirection();
    const dim = player.dimension
    const randPitch = Math.random() * 0.1
    dim.playSound(sound, { x: hd.x + vd.x, y: hd.y + vd.y, z: hd.z + vd.z }, { volume: 0.66, pitch: 0.9 + randPitch })
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    if (arrowTypes.includes(entity.typeId) == false) return;
    system.runTimeout(() => {
        if (entity.isValid) entity.addTag("dungeons:crossbow_checked")
    }, 5)
    const proj = entity.getComponent("projectile")
    if (!proj) return;
    const owner = proj.owner;
    if (!owner) return;
    const cause = e.cause;
    if (cause !== "Spawned") return;
    if (owner.typeId == "minecraft:player") {
        const equippable = owner.getComponent("equippable")
        if (!equippable) return;
        const held = equippable.getEquipment("Mainhand")
        if (!held) return;
        if (held.getDynamicProperty("dungeons:loaded") == true) {
            held.setDynamicProperty("dungeons:loaded", false)
            equippable.setEquipment("Mainhand", held)
            if (entity.isValid) entity.addTag("dungeons:crossbow_checked")
            if (entity.isValid && !entity.hasTag("dungeons:multishot_arrow")) crossbowFired(owner, held, entity)
        }
        if (!entity.hasTag("dungeons:ignore_arrow_tags")) {
            entity.addTag(held.typeId + "_fired_by")
            entity.addTag("dungeons:arrow")
            for (const tag of held.getTags()) {
                if (tag !== "dungeons:bow" && tag !== "dungeons:crossbow" && tag !== "oreville:is_bow" && tag !== "oreville:is_crossbow")
                    entity.addTag(tag + "_bow_effect")
            }
        }
        if (held.getDynamicProperty("dungeons:gild") !== undefined) {
            entity.addTag(held.getDynamicProperty("dungeons:gild") + "_bow_effect")
        }
        var canHit = 1
        const enchantable = held.getComponent("enchantable")
        if (enchantable) {
            const piercing = enchantable.getEnchantment("minecraft:piercing")
            if (piercing) canHit += piercing.level
        }
        entity.setDynamicProperty("dungeons:can_hit", canHit)
        if (held.hasTag("dungeons:bow")) {
            const customSoundComponent = held.getComponent("dungeons:shooter_sound")
            if (!customSoundComponent) return;
            const params = customSoundComponent.customComponentParameters.params
            playShootSound(owner, params.sound)
        }
    }
})

export function getWeaponFiredType(arrow) {
    var itemfound = undefined
    for (const checkTag of arrow.getTags()) {
        if (checkTag.includes("fired_by")) itemfound = checkTag.replace("_fired_by", "")
    }
    return itemfound
}

export function addTagsAfter(entity, weapon) {
    entity.addTag(weapon.typeId + "_fired_by")
    entity.addTag("dungeons:arrow")
    entity.addTag("dungeons:crossbow_checked")
    for (const tag of weapon.getTags()) {
        if (tag !== "dungeons:bow" && tag !== "dungeons:crossbow" && tag !== "oreville:is_bow" && tag !== "oreville:is_crossbow")
            entity.addTag(tag + "_bow_effect")
    }
}

import "./ranged/crossbowLoading.js"
import "./ranged/animation.js"
import "./ranged/arrowEffects.js"

//bow
import "./rangedEffects/growing.js"
import "./rangedEffects/ricochet.js"
import "./rangedEffects/hauntedBowTrail.js"

//longbow
import "./rangedEffects/supercharge.js"
import "./rangedEffects/strongSupercharge.js"
import "./rangedEffects/fuseShot.js"

//snow bow
import "./rangedEffects/freezing.js"
import "./rangedEffects/freezingStrong.js"

//soul bow
import "./rangedEffects/tempoTheft.js"

//wind bow
import "./rangedEffects/windBow.js"

//twisting vine bow
import "./rangedEffects/poisonTrail.js"

//void bow
import "./rangedEffects/voidStrike.js"

//exploding crossboww
import "./rangedEffects/gravity.js"
import "./rangedEffects/chainReaction.js"

//burst crossboww
import "./rangedEffects/criticalHit.js"
import "./rangedEffects/enigmaResonator.js"

//heavy crossboww
import "./rangedEffects/heavyCrossbow.js"
import "./rangedEffects/punch.js"

//cog crossboww
import "./rangedEffects/cogCrossbow.js"

//harpoon crossboww
import "./rangedEffects/harpoonCrossbow.js"
import "./rangedEffects/nauticalCrossbow.js"

//shadow crossboww
import "./rangedEffects/shadowShot.js"
import "./rangedEffects/shadowShotSpooky.js"
import "./rangedEffects/shriekingCrossbowTrail.js"
//veiled crossbow is handeled in the shadow effects file

//scatter crossbow
import "./rangedEffects/multiShot.js"

//bubble bow
import "./rangedEffects/bubbleBow.js"
import "./rangedEffects/reliableRicochet.js"

//dual crossbows
import "./rangedEffects/unchanting.js"

//power bows
import "./rangedEffects/radiance.js"