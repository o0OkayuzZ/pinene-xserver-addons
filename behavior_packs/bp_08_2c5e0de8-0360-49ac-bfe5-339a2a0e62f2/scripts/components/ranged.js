import {
    world,
    system,
    DimensionTypes,
    ItemStack
} from "@minecraft/server";

export const arrowTypes = [
    "minecraft:arrow",
    "dungeons:harpoon_arrow",
    "dungeons:burning_arrow",
    "dungeons:thundering_arrow",
    "dungeons:torment_arrow",
    "dungeons:firework_arrow",
    "dungeons:void_arrow"
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

export function playShootSound(player, sound, loc) {
    if(!loc) {
        const hd = player.getHeadLocation();
        const vd = player.getViewDirection();
        loc = { x: hd.x + vd.x, y: hd.y + vd.y, z: hd.z + vd.z }
    }
    const dim = player.dimension
    const randPitch = Math.random() * 0.1
    dim.playSound(sound, loc, { volume: 0.66, pitch: 0.9 + randPitch })
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const cause = e.cause;
    if (cause !== "Spawned") return;
    var entity = e.entity;
    if (!entity) return;
    if (!entity.isValid) return;
    const baseId = entity.typeId
    if (arrowTypes.includes(entity.typeId) == false) return;
    system.runTimeout(() => {
        if (entity.isValid) entity.addTag("dungeons:crossbow_checked")
    }, 5)
    entity.addTag("dungeons:fired_arrow")
    var proj = entity.getComponent("projectile")
    if (!proj) return;
    const owner = proj.owner;
    if (!owner) return;
    if (owner.typeId == "minecraft:player") {
        const quiverType = owner.getDynamicProperty("dungeons:arrow_slot")
        if(quiverType && entity.typeId == "minecraft:arrow" && !(entity.hasTag("dungeons:ricochet_arrow") || entity.hasTag("dungeons:reliable_ricochet_arrow") || entity.hasTag("dungeons:chain_reaction_arrow"))) {
            var newId = undefined
            if(quiverType == "firework") newId = "dungeons:firework_arrow"
            if(quiverType == "flaming") newId = "dungeons:burning_arrow"
            if(quiverType == "harpoon") newId = "dungeons:harpoon_arrow"
            if(quiverType == "thundering") newId = "dungeons:thundering_arrow"
            if(quiverType == "torment") newId = "dungeons:torment_arrow"
            if(quiverType == "void") newId = "dungeons:void_arrow"
            const v = entity.getVelocity()
            const newGuy = entity.dimension.spawnEntity(newId, entity.location)
            entity.remove()
            entity = newGuy
            proj = entity.getComponent("projectile")
            proj.owner = owner
            var power = 1.6
            if(quiverType == "firework") power = 1.8
            if(quiverType == "torment") power = 0.8
            var mult = power/1.6
            proj.shoot({
                x:v.x*mult,
                y:v.y*mult,
                z:v.z*mult
            })
            const quiverCount = owner.getDynamicProperty("dungeons:arrow_count")
            if(quiverCount == 1) {
                owner.setDynamicProperty("dungeons:arrow_count", null)
                owner.setDynamicProperty("dungeons:arrow_slot", null)
            } else {
                owner.setDynamicProperty("dungeons:arrow_count", quiverCount -1)
            }
            entity.addTag("dungeons:cannot_be_picked_up")
            
        }
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
        for (const propertyId of held.getDynamicPropertyIds()) {
            if (propertyId.includes("dungeons:gild_")) entity.addTag(propertyId.replace("gild_", "") + "_bow_effect")
        }

        var canHit = 1
        const enchantable = held.getComponent("enchantable")
        if (enchantable) {
            const piercing = enchantable.getEnchantment("minecraft:piercing")
            if (piercing) canHit += piercing.level
            const infinity = enchantable.getEnchantment("minecraft:infinity")
            if(infinity && owner.getGameMode() !== "Creative" && !entity.hasTag("dungeons:cannot_be_picked_up") && !entity.hasTag("dungeons:ricochet_arrow") && !entity.hasTag("dungeons:multishot_arrow") && !entity.hasTag("dungeons:reliable_ricochet_arrow")) {
                entity.addTag("dungeons:cannot_be_picked_up")
                if(entity.typeId.includes("dungeons") && entity.typeId == baseId) {
                    entity.removeTag("dungeons:cannot_be_picked_up")
                    owner.runCommand("clear @s " + entity.typeId + " -1 1")
                }
            }
        }
        if(owner.getGameMode() == "Creative") entity.addTag("dungeons:cannot_be_picked_up")
        entity.setDynamicProperty("dungeons:can_hit", canHit)
        if (held.hasTag("dungeons:bow")) {
            if(entity.hasTag("dungeons:multishot_arrow")) return;
            const customSoundComponent = held.getComponent("dungeons:shooter_sound")
            if (!customSoundComponent) return;
            const params = customSoundComponent.customComponentParameters.params
            var loc = undefined
            if(entity.hasTag("dungeons:ricochet_arrow") || entity.hasTag("dungeons:reliable_ricochet_arrow") || entity.hasTag("dungeons:chain_reaction_arrow")) loc = entity.location
            playShootSound(owner, params.sound, loc)
        }
    } else {
        entity.addTag("dungeons:cannot_be_picked_up")
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

world.afterEvents.entityDie.subscribe((e) => {
    const player = e.deadEntity;
    if(!player || !player.isValid || player.typeId !== "minecraft:player") return;
                player.setDynamicProperty("dungeons:arrow_count", null)
                player.setDynamicProperty("dungeons:arrow_slot", null)
})

//pickup

system.runInterval(() => {
    for(const dim of DimensionTypes.getAll()) {
        
        for(const arrow of world.getDimension(dim.typeId).getEntities({tags:["dungeons:fired_arrow"]})) {
            if(arrow.isOnGround) {
                var timer = arrow.getDynamicProperty("dungeons:ongroundtime")
                if(timer == undefined) {
                    arrow.setDynamicProperty("dungeons:ongroundtime", 1)
                } else if(timer < 10) {
                    arrow.setDynamicProperty("dungeons:ongroundtime", timer+1)
                }
            }
        }
    }
})


system.runInterval(() => {
    for(const player of world.getPlayers({excludeGameModes:["Spectator"]})) {
        for(const arrow of player.dimension.getEntities({tags:["dungeons:fired_arrow"], location: player.location, maxDistance: 2.15})) {
            if(arrow.isOnGround == false) {
                continue;
            };
            const timer = arrow.getDynamicProperty("dungeons:ongroundtime")
            if(timer <= 6) {
                continue;
            }
            const typeId = arrow.typeId
            const inventory = player.getComponent("inventory")
            const container = inventory.container;
            var passed = false
            var offhand = false
            for(let i = 0; i < container.size; i++) {
                const slot = container.getItem(i)
                if(slot == undefined) {
                    passed = true
                } else if(slot.typeId == typeId && slot.amount < slot.maxAmount) passed = true
            }
            if(!passed) {
                const equippable = player.getComponent("equippable")
                if(equippable) {
                    const offHand = equippable.getEquipment("Offhand")
                    if(offHand && offHand.typeId == typeId && offHand.maxAmount > offHand.amount) {
                        passed = true;
                        offhand = true;
                    }
                }
            }
            if(!passed) {
                console.warn("no space")
                continue;
            }
            const loc = arrow.location;
            const dim = arrow.dimension;
            const cannotTag = arrow.hasTag("dungeons:cannot_be_picked_up") ? true : false
            arrow.remove()
            dim.playSound("random.pop", loc, {volume:0.25, pitch: 0.6 + (Math.random()*1.6)})
            if(!cannotTag) {
                if(offhand) {
                    const equippable = player.getComponent("equippable")
                    if(equippable) {
                        const offHand = equippable.getEquipment("Offhand")
                        offHand.amount += 1
                        equippable.setEquipment("Offhand", offHand)
                    }
                } else {
                    player.dimension.spawnItem(new ItemStack(typeId, 1), player.location)
                }
            }
        }
    }
})

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
import "./rangedEffects/stunning.js"
import "./rangedEffects/bowMultishot.js"

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

//short bows
import "./rangedEffects/accelerate.js"
import "./rangedEffects/wildRage.js"

//trick bows
import "./rangedEffects/poisonCloud.js"
import "./rangedEffects/sugarRushTrail.js"

//hunting bows
import "./rangedEffects/huntingBow.js"
import "./rangedEffects/committed.js"
import "./rangedEffects/artefactCharge.js"


//gilds

import "./rangedEffects/shockweb.js"
import "./rangedEffects/cooldownShot.js"