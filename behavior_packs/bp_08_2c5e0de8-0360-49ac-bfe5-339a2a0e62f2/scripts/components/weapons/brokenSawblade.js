import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const bars = 50    

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:broken_sawblade', {
        onHitEntity(e, {params}) {
            const attacker = e.attackingEntity
            if(!attacker.hasTag("dungeons:broken_sawblade_charged")) {
                if (attacker.getItemCooldown("sawblade") > 0) return;
            }
            const type = params.unique ? "unique" : "common"
            attacker.dimension.playSound("weapon.sawblade.hit." + type, attacker.location)
        }
    });
});

world.afterEvents.itemStartUse.subscribe((e) => {
    const player = e.source
    const item = e.itemStack;
    if (!item) return;
    const saw = item.getComponent("dungeons:broken_sawblade")
    if (!saw) return;
    player.addTag("dungeons:broken_sawblade_charged")
    var i = 0
    var soundTick = 0
    const sawbladeComp = item.getComponent("dungeons:broken_sawblade")
    if (sawbladeComp == undefined) return;
    const unique = sawbladeComp.customComponentParameters.params.unique;
    const type = unique == true ? "unique" : "common"
    var instance = undefined
    var max = 100 + Math.floor(Math.random() * 80)
    if(type == "unique") max += 100
    //player.startItemCooldown("sawblade", 0)
    const particleId = unique ? "dungeons:sawblade_smoke_unique" : "dungeons:sawblade_smoke"
    const runInt = system.runInterval(() => {
        if(player.isValid == false) {
            player.runCommand("/camerashake stop @s")
            if(instance) instance.stop()
            system.clearRun(runInt)
        }
        const loc = player.location;
        const dim = player.dimension;
        if(soundTick == 0) {
            instance = dim.playSound("weapon.sawblade.loop." + type, loc, {pitch:Math.random()/4 + 0.8, volume: 0.3})
            soundTick = 20
        }
        if(!player.hasTag("dungeons:broken_sawblade_charged")) {
            player.runCommand("/camerashake stop @s")
            if(instance) instance.stop()
            system.clearRun(runInt)
        }
        const equippable = player.getComponent("equippable")
        const held = equippable.getEquipment("Mainhand")
        if(!held) system.clearRun(runInt)
        i += 1
        soundTick -= 1
        var barText = ""
        var filled = 0
        var div = max/bars
        barText += "§7"
        for(let j = 0; j < Math.ceil(i/div); j++) {
            filled += 1
            barText += "|"
        }
        if(!unique) barText += "§q§u§i§v§r§v"
        if(unique) barText += "§q§u§i§v§r§g"
        for(let j = filled; j < bars; j++) {
        barText += "|"
        }
        if(i > max*0.8) {
            if(Math.random() > 0.8 && i % 2 == 0) dim.spawnParticle(particleId, player.location)
            player.runCommand("camerashake add @s 0.02 0.2")
            if(i % 4 <= 1) barText = barText.replace("§q§u§i§v§r","§c§o§o§l§r")
        }
        player.onScreenDisplay.setActionBar(barText)
        if(i >= max) {
            player.runCommand("/camerashake stop @s")
            instance.stop()
            breakDown(player)
            system.clearRun(runInt)
        }

        //camerashake
        player.runCommand("camerashake add @s 0.1 0.1")

        //start breakin shit
        if(player.getGameMode() !== "Adventure" && !(player.dimension.id.includes("dungeons:ancientdim") && player.getGameMode() !== "Creative")) {
            const blockRay = player.getBlockFromViewDirection({maxDistance: 2.5, includeLiquidBlocks:false, includePassableBlocks: false})
            if(blockRay) {
                const blockBefore = blockRay.block;
                if(blockBefore.hasTag("log") || blockBefore.hasTag("minecraft:leaves")) {
                    var time = 20
                    if(blockBefore.hasTag("minecraft:leaves")) time = 10
                    const fatigue = player.getEffect("mining_fatigue")
                    if(fatigue) {
                        for(let i = 0; i < fatigue.amplifier+1; i++) {
                            time += 100
                        }
                    }
                    const beforePerm = blockBefore.permutation;
                    system.runTimeout(() => {
                        if(!player.isValid || !player.hasTag("dungeons:broken_sawblade_charged")) return;
                        const blockRay2 = player.getBlockFromViewDirection({maxDistance: 2.5, includeLiquidBlocks:false, includePassableBlocks: false, includePermutations:[beforePerm]})
                        if(blockRay2) {
                            if(blockRay2.block.location == blockBefore.location)
                            world.sendMessage("woah")
                            blockRay2.block.dimension.runCommand(`setblock ${blockBefore.x} ${blockBefore.y} ${blockBefore.z} air destroy`)
                        }
                    },time)
                }
            }
        }
        //animation
        if (player.hasTag("dungeons:in_shadow_form")) return;
        if (player.hasTag("dungeons:block_greatsword_animation")) return;
        if (player.hasTag("dungeons:rolling")) return;
        player.playAnimation('animation.player.sawblade_use', { blendOutTime: 1.5*getWeaponCooldownMult(player)*0.5, nextState: 'claymoreHold' })
    })
})
world.afterEvents.itemStopUse.subscribe((e) => {
    const player = e.source
    const item = e.itemStack;
    if (!item) return;
    const saw = item.getComponent("dungeons:broken_sawblade")
    if (!saw) return;
    player.removeTag("dungeons:broken_sawblade_charged")
    if(player.getItemCooldown("minecraft:sawblade") >= 1) return;
    player.startItemCooldown("sawblade", Math.ceil(30*getWeaponCooldownMult(player)))
    system.runTimeout(() => { player.onScreenDisplay.setActionBar(" ")},1)
})

import { isWearingMysteryArmour, isWearingSet } from "components/armour.js"
function getWeaponCooldownMult(player) {
    var mult = 1;
    if (isWearingMysteryArmour(player, "weapon_speed")) return 0.75
    if (isWearingSet(player, "dungeons:thief_armour")) return 0.75
    if (isWearingSet(player, "dungeons:emerald_armour")) return 0.85
    if (isWearingSet(player, "dungeons:mercenary_armour") && !isWearingSet(player, "dungeons:renegade_armour")) return 0.75
    if (isWearingSet(player, "dungeons:renegade_armour")) return 0.5
    if (isWearingSet(player, "dungeons:black_wolf_armour")) return 2/3
    return mult
}

function breakDown(player) {
    const equippable = player.getComponent("equippable")
    const held = equippable.getEquipment("Mainhand")
    if(!held) return
    const sawbladeComp = held.getComponent("dungeons:broken_sawblade")
    if (sawbladeComp == undefined) return;
    const unique = sawbladeComp.customComponentParameters.params.unique;
    const type = unique == true ? "unique" : "common"
    const mult = getWeaponCooldownMult(player)
    player.startItemCooldown("sawblade", Math.ceil(120*mult))
    player.addTag("dungeons:sawblade_brokedown")
    equippable.setEquipment("Mainhand", undefined)
    const slot = player.selectedSlotIndex
    const loc = player.location;
    const dim = player.dimension;
    dim.playSound(`weapon.sawblade.break.${type}`, loc)
    player.runCommand("camerashake add @s 0.2 1")
    system.runTimeout(() => {
        if(!player.isValid) {
            dim.spawnItem(held, loc)
            return;
        }
            var barText = "§q§u§i§v§r§7"
            var altBarText = "§q§u§i§v§r§8"
            for(let j = 0; j < bars; j++) {
                altBarText += "|"
                barText += "|"
            }
            player.onScreenDisplay.setActionBar(barText)
            system.runTimeout(() => {
                player.onScreenDisplay.setActionBar(altBarText)
                system.runTimeout(() => {
                    player.onScreenDisplay.setActionBar(barText)
                    system.runTimeout(() => {
                        player.onScreenDisplay.setActionBar(altBarText)
                        system.runTimeout(() => {
                            player.onScreenDisplay.setActionBar(barText)
                            system.runTimeout(() => {
                                player.onScreenDisplay.setActionBar(altBarText)
                                system.runTimeout(() => {
                                    player.onScreenDisplay.setActionBar(barText)
                                    system.runTimeout(() => {
                                        player.onScreenDisplay.setActionBar(altBarText)
                                        system.runTimeout(() => {
                                            player.onScreenDisplay.setActionBar(barText)
                                            system.runTimeout(() => {
                                                player.onScreenDisplay.setActionBar(altBarText)
                                            }, 2)
                                        }, 2)
                                    }, 2)
                                }, 2)
                            }, 2)
                        }, 2)
                    }, 2)
                }, 2)
            }, 2)
        
        const inv = player.getComponent("inventory")
        if(inv.container.getItem(slot) !== undefined) {
            dim.spawnItem(held, loc)
            return;

        }
        inv.container.setItem(slot, held)
    },1)
    
    if (player.hasTag("dungeons:in_shadow_form")) return;
    if (player.hasTag("dungeons:block_greatsword_animation")) return;
    if (player.hasTag("dungeons:rolling")) return;
    player.playAnimation('animation.player.sawblade_use', { blendOutTime: 6*getWeaponCooldownMult(player)*0.5, nextState: 'claymoreHold' })
}

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    const sawbladeComp = heldItem.getComponent("dungeons:broken_sawblade")
    if (sawbladeComp == undefined) return;
    const unique = sawbladeComp.customComponentParameters.params.unique;
    //effect code
    if (e.damage <= 0) return;
    if(!attacker.hasTag("dungeons:broken_sawblade_charged")) {
        if(attacker.getItemCooldown("minecraft:sawblade") > 0) e.cancel = true;
        return;
    };
    const mult = unique == true ? 7 : 6
    let enchantBonus = 0;

    const sharpness = getEnchantLevel(heldItem, "sharpness")
    if (sharpness) enchantBonus += Math.floor(sharpness * 1.25)

    const smite = getEnchantLevel(heldItem, "smite")
    if (smite && hurt.matches({families: ["undead"]})) enchantBonus += smite * 2.5

    const bane = getEnchantLevel(heldItem, "bane_of_arthropods")
    if (bane && hurt.matches({families: ["arthropod"]})) enchantBonus += bane * 2.5
    if (enchantBonus > 0) {
        e.damage = e.damage * (1 / (1 + enchantBonus));
    }
    e.damage = e.damage * mult
    if(sharpness > 0) e.damage = e.damage * (1 + sharpness/4)
    if(smite > 0 && hurt.matches({families:["undead"]})) e.damage = e.damage * (1 + smite/2.2)
    if(bane > 0 && hurt.matches({families:["arthropod"]})) e.damage = e.damage * (1 + bane/2.2)
    system.run(() => {
        const dim = hurt.dimension;
        const hurtLoc = hurt.location;
        for(let i = 0; i < Math.ceil(Math.min(e.damage,10)); i++) {
            dim.spawnParticle(heldItem.typeId, hurtLoc)
            if(unique && Math.random() > 0.9) dim.spawnParticle("minecraft:lava_particle", hurt.getHeadLocation())
        }
        attacker.runCommand("camerashake add @s 0.3 0.1")
        var rand = Math.random();
        var odds = 1 - e.damage/(unique ? 300 : 100)
        if(rand > odds) {
            breakDown(attacker)
        } else if(attacker.getGameMode() !== "Creative") {
            var chance = 1
            const unbreaking = heldItem.getComponent("enchantable").getEnchantment("unbreaking")
            if (unbreaking) {
                chance = 1 / (unbreaking.level + 1)
            }
            if(Math.random() <= chance) {
                const durability = heldItem.getComponent("durability")
                if(durability.damage + 1 > durability.maxDurability) {
                    equippable.setEquipment("Mainhand", undefined)
                    attacker.dimension.playSound("random.break", attacker.location)
                } else {
                    durability.damage += 1
                    equippable.setEquipment("Mainhand", heldItem)
                }
            }
        }
    })
});


function getEnchantLevel(item, enchant) {
    const enchantable = item.getComponent("enchantable")
    if(enchantable) {
        for(const enchantment of enchantable.getEnchantments()) {
            if (enchantment.type.id === enchant) {
                return enchantment.level
            }
        }
    }
    return 0

}

system.runInterval(() => {
    for(const player of world.getPlayers({excludeGameModes:["Spectator"]})) {
        const cd = player.getItemCooldown("minecraft:sawblade")
        const equippable = player.getComponent("equippable")
        if(!equippable) continue;
        const held = equippable.getEquipment("Mainhand")
        if(!held) continue;
        const sawbladeComp = held.getComponent("dungeons:broken_sawblade")
        if (sawbladeComp == undefined) continue;
        if(held.getDynamicProperty("dungeons:sawblade_heat")) {
            const lore = held.getLore()
            var newLore = []
            for(const entry  of lore) {
                if(entry.includes("§h§e§a§t§r§8")) continue;
                newLore.push(entry)
            }
            held.setDynamicProperty("dungeons:sawblade_heat", null)
            held.setLore(newLore)
        }
        if(cd <= 40) continue;
        const unique = sawbladeComp.customComponentParameters.params.unique;
        const type = unique == true ? "_unique" : ""
        if(player.dimension.isChunkLoaded(player.location)) player.dimension.spawnParticle("dungeons:sawblade_smoke" + type, player.location)
    }
},5)