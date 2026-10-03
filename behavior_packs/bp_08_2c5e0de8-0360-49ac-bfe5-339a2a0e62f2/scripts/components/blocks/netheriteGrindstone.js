
import {
    system,
    world,
    ItemStack
} from "@minecraft/server";

import {
    MessageFormData
} from "@minecraft/server-ui";

function canBeSalvaged(item) {
    var canSalvage = false
    if (item.typeId.includes("of_swiftness")) {
        for (const salvage of salvages) if (salvage.item == item.typeId.replace("dungeons:rare_", "dungeons:")) canSalvage = true

    } else {
        for (const salvage of salvages) if (salvage.item == item.typeId.replace("dungeons:rare_", "dungeons:").replace("helmet", "armour").replace("chestplate", "armour").replace("leggings", "armour").replace("boots", "armour")) canSalvage = true
    }
    if (!canSalvage) return false;
    return true;
}

function getSalvageData(item) {
    var lookup = undefined
    if (item.typeId.includes("of_swiftness")) {
        for (const salvage of salvages) if (salvage.item == item.typeId.replace("dungeons:rare_", "dungeons:")) lookup = salvage

    } else {
        for (const salvage of salvages) if (salvage.item == item.typeId.replace("dungeons:rare_", "dungeons:").replace("helmet", "armour").replace("chestplate", "armour").replace("leggings", "armour").replace("boots", "armour")) lookup = salvage
    }
    return lookup

}

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:netherite_grindstone", {
        onPlayerInteract(e) {
            const { block, dimension, player } = e;
            if (!block || !player) return;
            if (dimension.isChunkLoaded(block.location) == false) return;
            const equippable = player.getComponent("equippable")
            const item = equippable.getEquipment("Mainhand")
            if (!item || !canBeSalvaged(item)) {
                player.playSound("block.grindstone.use", { pitch: 0.4, volume: 0.5 })
                return player.sendMessage({ translate: "dungeons.warn.invalid_grindstone_item" })
            }
            const salvageData = getSalvageData(item)
            if (!salvageData) {
                player.playSound("block.grindstone.use", { pitch: 0.4, volume: 0.5 })
                return player.sendMessage({ translate: "dungeons.warn.invalid_grindstone_item" })
            }

            salvageItem(player, item, block)
        }
    });
})

function salvageItem(player, item, block) {
    const form = new MessageFormData()
    form.title({translate:block.localizationKey})
    form.body({rawtext:[{text: "§g"},{translate:item.localizationKey},{text:"§r - "},{translate:"dungeons.grindstone_description"}]})
    form.button1({translate:"dungeons.grindstone_button1"})
    form.button2({translate:"dungeons.grindstone_button2"})
    form.show(player).then(r => {
        if(r.canceled || r.selection == undefined || r.selection == 0) return;
        const equippable = player.getComponent("equippable")
        const held = equippable.getEquipment("Mainhand")
        if (!held || held.typeId !== item.typeId) {
            dimension.playSound("block.grindstone.use", { pitch: 0.4, volume: 0.5 })
            return player.sendMessage({ translate: "dungeons.warn.invalid_grindstone_item" })
        }
        const dim = block.dimension;
        const loc = block.above().bottomCenter()
        const salvageData = getSalvageData(item)
        for (let i = 0; i < salvageData.returns.length; i++) {
            const returnData = salvageData.returns[i]
            const id = returnData[0]
            var value = returnData[2] - Math.round(Math.random() * (returnData[2] - returnData[1]))
            if (value < 1 && value > 0) {
                if (Math.random() <= value) {
                    value = 1
                } else {
                    value = 0
                }
            }
            if (value > 0) system.run(() => { dim.spawnItem(new ItemStack(id, value), loc) })
        }
        var enchantCount = 0;
        var enchantIndvCount = 0
        if (salvageData.runes) {
            var bonusRunePct = 1
            if(item.getComponent("enchantable")) {
                for(const enchantment of item.getComponent("enchantable").getEnchantments()) {
                    enchantCount += enchantment.level
                    enchantIndvCount += 1
                }
            }
            for(let i = 0; i < enchantCount; i++) {
                bonusRunePct = bonusRunePct * (0.85)
            }
            bonusRunePct = 1 - bonusRunePct
            var runesToDrop = []
            var randomRunes = []
            for (const entry of salvageData.runes) randomRunes.push(entry)
            randomRunes = randomRunes.sort(function randomSort(a, b) {
                return 0.5 - Math.random();
            })
            var rarityBase = 0.1
            if (item.hasTag("dungeons:unique_item") || item.hasTag("dungeons:seasonal_item") || item.getComponent("dungeons:artefact_cooldown")) rarityBase = 0.7
            var rarityMod = 0.1
            if (item.hasTag("dungeons:unique_item") || item.hasTag("dungeons:seasonal_item") || item.getComponent("dungeons:artefact_cooldown")) rarityMod = 0.2
            if (item.hasTag("minecraft:is_armor")) {
                rarityBase = rarityBase / 2
                rarityBase += enchantIndvCount/10
            } else {
                rarityBase += enchantIndvCount/8
            }
            for (let i = 0; i < randomRunes.length; i++) {
                if (Math.random() > i / randomRunes.length && Math.random() < rarityBase + ((randomRunes.length - 1) * rarityMod)) {
                    runesToDrop.push(randomRunes[i])
                }
            }
            if (runesToDrop.length > 0) {
                dim.spawnParticle("dungeons:illagers_bane_1", { x: loc.x, y: loc.y + 0.3, z: loc.z })
                for (const rune of runesToDrop) {
                    system.run(() => { dim.spawnItem(new ItemStack("dungeons:enchanted_rune_" + rune, 1 + (Math.random() < bonusRunePct ? 1 : 0)), loc).clearVelocity() })
                }
            }
        }
        var isGild = false
        for (const propertyId of item.getDynamicPropertyIds()) {
            if (propertyId.includes("dungeons:gild_")) isGild = true
        }
        if (isGild) {
            var maxGold = 6
            if (item.hasTag("minecraft:is_armor")) maxGold = 2
            var gold = maxGold - Math.round(Math.random() * (maxGold - 1))
            if (item.hasTag("dungeons:unique_item") || item.hasTag("dungeons:seasonal_item") || item.getComponent("dungeons:artefact_cooldown")) gold = Math.ceil(gold * 1.5)
            if (gold > 0) system.run(() => { dim.spawnItem(new ItemStack("dungeons:ancient_gold_ingot", gold), loc) })

        }
        for(let i = 0; i < enchantCount; i++) {
            const rand = Math.floor(Math.random()*4) + 1
            for(let j = 0; j < rand; j++) {
                dim.spawnEntity("minecraft:xp_orb", loc)
            }
        }
        dim.spawnParticle("dungeons:daggers_strike", loc)
        dim.playSound("mob.irongolem.repair", loc, { pitch: 0.7, volume: 0.8 })
        dim.playSound("block.grindstone.use", loc, { pitch: 0.9, volume: 0.8 })
        equippable.setEquipment("Mainhand", undefined)
        player.runCommand("scriptevent dungeons:salvaged_item " + item.typeId)
    }).catch(e => {
        console.error(e, e.stack);
    });

}





export const salvages = [
    {
        item: "minecraft:iron_sword",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ]
    },
    {
        item: "minecraft:iron_pickaxe",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:iron_axe",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:iron_shovel",
        returns: [
            ["minecraft:iron_nugget", 4, 8]
        ]
    },
    {
        item: "minecraft:iron_hoe",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ]
    },
    {
        item: "minecraft:iron_spear",
        returns: [
            ["minecraft:iron_nugget", 4, 8]
        ]
    },
    {
        item: "minecraft:iron_boots",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:iron_chestplate",
        returns: [
            ["minecraft:iron_ingot", 1, 6]
        ]
    },
    {
        item: "minecraft:iron_leggings",
        returns: [
            ["minecraft:iron_ingot", 1, 5]
        ]
    },
    {
        item: "minecraft:iron_helmet",
        returns: [
            ["minecraft:iron_ingot", 1, 4]
        ]
    },
    {
        item: "minecraft:copper_sword",
        returns: [
            ["minecraft:copper_ingot", 1, 2]
        ]
    },
    {
        item: "minecraft:copper_pickaxe",
        returns: [
            ["minecraft:copper_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:copper_axe",
        returns: [
            ["minecraft:copper_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:copper_shovel",
        returns: [
            ["minecraft:copper_nugget", 4, 8]
        ]
    },
    {
        item: "minecraft:copper_hoe",
        returns: [
            ["minecraft:copper_ingot", 1, 2]
        ]
    },
    {
        item: "minecraft:copper_spear",
        returns: [
            ["minecraft:copper_nugget", 4, 8]
        ]
    },
    {
        item: "minecraft:copper_boots",
        returns: [
            ["minecraft:copper_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:copper_chestplate",
        returns: [
            ["minecraft:copper_ingot", 1, 6]
        ]
    },
    {
        item: "minecraft:copper_leggings",
        returns: [
            ["minecraft:copper_ingot", 1, 5]
        ]
    },
    {
        item: "minecraft:copper_helmet",
        returns: [
            ["minecraft:copper_ingot", 1, 4]
        ]
    },
    {
        item: "minecraft:golden_sword",
        returns: [
            ["minecraft:gold_ingot", 1, 2]
        ]
    },
    {
        item: "minecraft:golden_pickaxe",
        returns: [
            ["minecraft:gold_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:golden_axe",
        returns: [
            ["minecraft:gold_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:golden_shovel",
        returns: [
            ["minecraft:gold_nugget", 4, 8]
        ]
    },
    {
        item: "minecraft:golden_hoe",
        returns: [
            ["minecraft:gold_ingot", 1, 2]
        ]
    },
    {
        item: "minecraft:golden_spear",
        returns: [
            ["minecraft:gold_nugget", 4, 8]
        ]
    },
    {
        item: "minecraft:golden_boots",
        returns: [
            ["minecraft:gold_ingot", 1, 3]
        ]
    },
    {
        item: "minecraft:golden_chestplate",
        returns: [
            ["minecraft:gold_ingot", 1, 6]
        ]
    },
    {
        item: "minecraft:golden_leggings",
        returns: [
            ["minecraft:gold_ingot", 1, 5]
        ]
    },
    {
        item: "minecraft:golden_helmet",
        returns: [
            ["minecraft:gold_ingot", 1, 4]
        ]
    },
    {
        item: "minecraft:diamond_sword",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_pickaxe",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_axe",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_shovel",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_hoe",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_spear",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_boots",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:diamond_chestplate",
        returns: [
            ["minecraft:diamond", 0, 2]
        ]
    },
    {
        item: "minecraft:diamond_leggings",
        returns: [
            ["minecraft:diamond", 0, 2]
        ]
    },
    {
        item: "minecraft:diamond_helmet",
        returns: [
            ["minecraft:diamond", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_sword",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_pickaxe",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_axe",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_shovel",
        returns: [
            ["minecraft:diamond", 0, 1],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_hoe",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_spear",
        returns: [
            ["minecraft:diamond", 0, 1],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_boots",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_chestplate",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_leggings",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:netherite_helmet",
        returns: [
            ["minecraft:diamond", 0, 2],
            ["minecraft:netherite_scrap", 0, 1]
        ]
    },
    {
        item: "minecraft:shield",
        returns: [
            ["minecraft:stick", 4, 8],
            ["minecraft:iron_ingot", 0, 1]
        ]
    },
    {
        item: "minecraft:mace",
        returns: [
            ["minecraft:breeze_rod", 1, 1],
            ["minecraft:heavy_core", 0, 0.5]
        ]
    },
    {
        item: "minecraft:trident",
        returns: [
            ["minecraft:prismarine_shard", 1, 4]
            ["dungeons:diamond_dust", 0, 0.5]
        ]
    },
    //custom melees
    {
        item: "dungeons:sword",
        bookId: "dungeons:longsword",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:diamond_sword",
        bookId: "dungeons:diamond_longsword",
        returns: [
            ["minecraft:diamond", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:hawkbrand",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:sinister_sword",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:katana",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:masters_katana",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:dark_katana",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:claymore",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:broadsword",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "t",
            "i"
        ]
    },
    {
        item: "dungeons:heartstealer",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "t",
            "i"
        ]
    },
    {
        item: "dungeons:great_axeblade",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:cutlass",
        returns: [
            ["minecraft:iron_ingot", 1, 2],
            ["minecraft:gold_nugget", 2, 6]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:nameless_blade",
        returns: [
            ["minecraft:obsidian", 2, 3]
        ],
        runes: [
            "i",
            "s"
        ]
    },
    {
        item: "dungeons:dancers_sword",
        returns: [
            ["minecraft:iron_ingot", 3, 6],
            ["minecraft:gold_ingot", 2, 6]
        ],
        runes: [
            "i",
            "c"
        ]
    },
    {
        item: "dungeons:sparkler",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "i",
            "c"
        ]
    },
    {
        item: "dungeons:daggers",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:sheer_daggers",
        returns: [
            ["minecraft:iron_ingot", 4, 8]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:moon_daggers",
        returns: [
            ["minecraft:iron_ingot", 4, 8],
            ["minecraft:gold_ingot", 2, 4]
        ],
        runes: [
            "i",
            "o"
        ]
    },
    {
        item: "dungeons:frost_knives",
        returns: [
            ["minecraft:packed_ice", 4, 8]
        ],
        runes: [
            "i",
            "s"
        ]
    },
    {
        item: "dungeons:rapier",
        returns: [
            ["minecraft:iron_ingot", 1, 1],
            ["minecraft:iron_nugget", 2, 7]
        ],
        runes: [
            "i",
            "p"
        ]
    },
    {
        item: "dungeons:freezing_foil",
        returns: [
            ["minecraft:iron_ingot", 2, 4],
            ["minecraft:packed_ice", 0, 2]
        ],
        runes: [
            "i",
            "p",
            "s"
        ]
    },
    {
        item: "dungeons:bee_stinger",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i",
            "p",
            "u"
        ]
    },
    {
        item: "dungeons:sickles",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:the_last_laugh",
        returns: [
            ["minecraft:iron_ingot", 3, 6],
            ["minecraft:gold_ingot", 3, 6]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:nightmares_bite",
        returns: [
            ["minecraft:iron_ingot", 3, 6]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:glaive",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:grave_bane",
        returns: [
            ["minecraft:gold_ingot", 2, 6]
        ],
        runes: [
            "s",
            "i"
        ]
    },
    {
        item: "dungeons:venom_glaive",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "s",
            "a"
        ]
    },
    {
        item: "dungeons:cackling_broom",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "s",
            "i"
        ]
    },
    {
        item: "dungeons:battlestaff",
        returns: [
            ["minecraft:stick", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:battlestaff_of_terror",
        returns: [
            ["minecraft:iron_ingot", 1, 4]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:growing_staff",
        returns: [
            ["minecraft:gold_ingot", 1, 4]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:sharpened_pickaxe",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:sharpened_diamond_pickaxe",
        returns: [
            ["minecraft:diamond", 1, 3]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:the_monkey_motivator",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "i",
            "r"
        ]
    },
    {
        item: "dungeons:axe",
        bookId: "dungeons:cleaving_axe",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:firebrand",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:highlands_axe",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "i",
            "s"
        ]
    },
    {
        item: "dungeons:double_axe",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i",
            "t"
        ]
    },
    {
        item: "dungeons:cursed_axe",
        returns: [
            ["minecraft:iron_ingot", 4, 8]
        ],
        runes: [
            "i",
            "t",
            "a"
        ]
    },
    {
        item: "dungeons:whirlwind",
        returns: [
            ["minecraft:iron_ingot", 4, 8]
        ],
        runes: [
            "i",
            "t",
            "a"
        ]
    },
    {
        item: "dungeons:rush_spear",
        returns: [
            ["minecraft:iron_ingot", 1, 1]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:whispering_spear",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "s",
            "i"
        ]
    },
    {
        item: "dungeons:fortune_spear",
        returns: [
            ["minecraft:gold_ingot", 2, 4]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:spine_chill_spear",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "s",
            "i"
        ]
    },
    {
        item: "dungeons:coral_blade",
        returns: [
            ["minecraft:stick", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:sponge_striker",
        returns: [
            ["minecraft:stick", 0, 1]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:tempest_knife",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:chill_gale_knife",
        returns: [
            ["minecraft:gold_ingot", 2, 4],
            ["minecraft:iron_ingot", 2, 3]
        ],
        runes: [
            "c",
            "s"
        ]
    },
    {
        item: "dungeons:resolute_tempest_knife",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "c",
            "i"
        ]
    },
    {
        item: "dungeons:soul_knife",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:truthseeker",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "o",
            "i"
        ]
    },
    {
        item: "dungeons:eternal_knife",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:soul_scythe",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:frost_scythe",
        returns: [
            ["minecraft:blue_ice", 2, 6]
        ],
        runes: [
            "o",
            "s"
        ]
    },
    {
        item: "dungeons:jailors_scythe",
        returns: [
            ["minecraft:iron_ingot", 2, 6]
        ],
        runes: [
            "o",
            "a"
        ]
    },
    {
        item: "dungeons:skull_scythe",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "o",
            "s"
        ]
    },
    {
        item: "dungeons:gauntlets",
        returns: [
            ["minecraft:iron_ingot", 1, 2],
            ["minecraft:leather", 0, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:soul_fists",
        returns: [
            ["minecraft:gold_ingot", 2, 4]
        ],
        runes: [
            "i",
            "o"
        ]
    },
    {
        item: "dungeons:fighters_bindings",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i",
            "c"
        ]
    },
    {
        item: "dungeons:maulers",
        returns: [
            ["minecraft:leather", 2, 4]
        ],
        runes: [
            "i",
            "c"
        ]
    },
    {
        item: "dungeons:whip",
        returns: [
            ["minecraft:iron_ingot", 0, 1],
            ["minecraft:string", 1, 2]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:vine_whip",
        returns: [
            ["minecraft:iron_ingot", 1, 1],
            ["minecraft:vine", 1, 2]
        ],
        runes: [
            "s",
            "i"
        ]
    },
    {
        item: "dungeons:broken_sawblade",
        returns: [
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:mechanised_sawblade",
        returns: [
            ["minecraft:iron_ingot", 3, 6],
            ["minecraft:blaze_rod", 0, 2]
        ],
        runes: [
            "c",
            "t"
        ]
    },
    {
        item: "dungeons:great_hammer",
        returns: [
            ["minecraft:cobblestone", 1, 6],
            ["minecraft:iron_ingot", 0, 4]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:stormlander",
        returns: [
            ["minecraft:cobblestone", 3, 6],
            ["minecraft:iron_ingot", 3, 8]
        ],
        runes: [
            "t",
            "a"
        ]
    },
    {
        item: "dungeons:hammer_of_gravity",
        returns: [
            ["minecraft:cobblestone", 3, 6],
            ["minecraft:iron_ingot", 3, 8]
        ],
        runes: [
            "t",
            "a"
        ]
    },
    {
        item: "dungeons:bonehead_hammer",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "t",
            "a"
        ]
    },
    {
        item: "dungeons:mace",
        bookId: "dungeons:iron_mace",
        returns: [
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:suns_grace",
        returns: [
            ["minecraft:gold_ingot", 2, 4]
        ],
        runes: [
            "i",
            "s"
        ]
    },
    {
        item: "dungeons:flail",
        returns: [
            ["minecraft:iron_ingot", 2, 4]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:anchor",
        returns: [
            ["minecraft:iron_ingot", 4, 8]
        ],
        runes: ["t"]
    },
    {
        item: "dungeons:encrusted_anchor",
        returns: [
            ["minecraft:gold_ingot", 8, 16]
        ],
        runes: ["t", "s"]
    },
    {
        item: "dungeons:bone_club",
        returns: [
            ["minecraft:bone", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:bone_cudgel",
        returns: [
            ["minecraft:bone", 2, 4]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:backstabber",
        returns: [
            ["minecraft:gold_ingot", 1, 2]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:swift_striker",
        returns: [
            ["minecraft:gold_ingot", 3, 6]
        ],
        runes: [
            "c",
            "i"
        ]
    },
    {
        item: "dungeons:void_touched_blades",
        returns: [
            ["minecraft:ender_pearl", 0, 1],
            ["minecraft:popped_chorus_fruit", 1, 2]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:the_beginning_and_the_end",
        returns: [
            ["minecraft:ender_pearl", 0, 2],
            ["minecraft:gold_ingot", 3, 6]
        ],
        runes: [
            "s",
            "a"
        ]
    },
    {
        item: "dungeons:obsidian_claymore",
        returns: [
            ["minecraft:obsidian", 1, 3]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:starless_night",
        returns: [
            ["minecraft:crying_obsidian", 1, 3]
        ],
        runes: [
            "t",
            "i"
        ]
    },
    //vanilla and custom ranged
    {
        item: "minecraft:bow",
        bookId: "dungeons:bow",
        returns: [
            ["minecraft:stick", 1, 3]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:bonebow",
        returns: [
            ["minecraft:bone", 1, 3]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:twin_bow",
        returns: [
            ["minecraft:stick", 1, 3]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:haunted_bow",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:bubble_bow",
        returns: [
            ["minecraft:lapis_lazuli", 1, 3]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:bubble_burster",
        returns: [
            ["minecraft:lapis_lazuli", 2, 5]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:gloopy_bow",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:longbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_nugget", 0, 3]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:red_snake",
        returns: [
            ["minecraft:netherrack", 1, 3],
            ["minecraft:iron_nugget", 2, 6]
        ],
        runes: [
            "r",
            "a"
        ]
    },
    {
        item: "dungeons:guardian_bow",
        returns: [
            ["minecraft:prismarine_shard", 1, 3],
            ["minecraft:iron_nugget", 2, 6]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:power_bow",
        returns: [
            ["minecraft:iron_ingot", 0, 2],
            ["minecraft:iron_nugget", 0, 3]
        ],
        runes: [
            "r",
            "i"
        ]
    },
    {
        item: "dungeons:elite_power_bow",
        returns: [
            ["minecraft:gold_ingot", 0, 2],
            ["minecraft:gold_nugget", 0, 3]
        ],
        runes: [
            "r",
            "i"
        ]
    },
    {
        item: "dungeons:sabrewing",
        returns: [
            ["minecraft:gold_ingot", 0, 2],
            ["minecraft:iron_nugget", 0, 3]
        ],
        runes: [
            "r",
            "i",
            "s"
        ]
    },
    {
        item: "dungeons:phantom_bow",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "r",
            "i"
        ]
    },
    {
        item: "dungeons:shortbow",
        returns: [
            ["minecraft:stick", 0, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:love_spell_bow",
        returns: [
            ["minecraft:stick", 0, 2],
            ["minecraft:sugar", 1, 3]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:mechanical_shortbow",
        returns: [
            ["minecraft:stick", 0, 2],
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "r",
            "c"
        ]
    },
    {
        item: "dungeons:purple_storm",
        returns: [
            ["minecraft:stick", 0, 2],
            ["minecraft:copper_nugget", 1, 3]
        ],
        runes: [
            "r",
            "c"
        ]
    },
    {
        item: "dungeons:trickbow",
        returns: [
            ["minecraft:iron_nugget", 0, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:the_green_menace",
        returns: [
            ["minecraft:slime_ball", 1, 3]
        ],
        runes: [
            "r",
            "a"
        ]
    },
    {
        item: "dungeons:the_pink_scoundrel",
        returns: [
            ["minecraft:pink_dye", 1, 3]
        ],
        runes: [
            "r",
            "i"
        ]
    },
    {
        item: "dungeons:sugar_rush",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "r",
            "i"
        ]
    },
    {
        item: "dungeons:snow_bow",
        returns: [
            ["minecraft:stick", 0, 2],
            ["minecraft:snowball", 1, 3]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:winters_touch",
        returns: [
            ["minecraft:stick", 0, 2],
            ["minecraft:snowball", 1, 3]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:webbed_bow",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:twisting_vine_bow",
        returns: [
            ["minecraft:twisting_vines", 1, 3]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:weeping_vine_bow",
        returns: [
            ["minecraft:weeping_vines", 1, 3]
        ],
        runes: [
            "r",
            "c"
        ]
    },
    {
        item: "dungeons:void_bow",
        returns: [
            ["dungeons:void_fluid", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:call_of_the_void",
        returns: [
            ["dungeons:void_fluid", 0, 1]
        ],
        runes: [
            "a",
            "r"
        ]
    },
    {
        item: "dungeons:wind_bow",
        returns: [
            ["minecraft:wind_charge", 0, 1],
            ["minecraft:stick", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:burst_gale_bow",
        returns: [
            ["minecraft:wind_charge", 0, 1],
            ["minecraft:gold_ingot", 1, 2]
        ],
        runes: [
            "i",
            "c"
        ]
    },
    {
        item: "dungeons:echo_of_the_valley",
        returns: [
            ["minecraft:wind_charge", 0, 1],
            ["minecraft:stick", 1, 2]
        ],
        runes: [
            "i",
            "r"
        ]
    },
    {
        item: "minecraft:crossbow",
        bookId: "dungeons:crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_ingot", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:azure_seeker",
        returns: [
            ["minecraft:lapis_lazuli", 1, 4],
            ["minecraft:iron_ingot", 1, 4]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:the_slicer",
        returns: [
            ["minecraft:stick", 1, 4],
            ["minecraft:iron_ingot", 1, 4]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:cog_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_ingot", 1, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:pride_of_the_piglins",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:gold_ingot", 2, 3]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:dual_crossbows",
        returns: [
            ["minecraft:stick", 2, 5],
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:baby_crossbows",
        returns: [
            ["minecraft:stick", 2, 5],
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:spellbound_crossbows",
        returns: [
            ["minecraft:stick", 2, 5],
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "r",
            "a"
        ]
    },
    {
        item: "dungeons:exploding_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:tnt", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:firebolt_thrower",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:tnt", 0, 1],
            ["minecraft:fire_charge", 1, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:imploding_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:tnt", 0, 1],
            ["minecraft:ender_pearl", 1, 1]
        ],
        runes: [
            "i",
            "a"
        ]
    },
    {
        item: "dungeons:rapid_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_ingot", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:auto_crossbow",
        returns: [
            ["minecraft:copper_ingot", 1, 4],
            ["minecraft:iron_ingot", 1, 4]
        ],
        runes: [
            "r",
            "c"
        ]
    },
    {
        item: "dungeons:butterfly_crossbow",
        returns: [
            ["minecraft:stick", 1, 4],
            ["minecraft:emerald", 1, 4]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:harpoon_crossbow",
        returns: [
            ["minecraft:iron_nugget", 1, 3],
            ["minecraft:iron_ingot", 1, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:harpoon_crossbow",
        returns: [
            ["minecraft:gold_nugget", 2, 6],
            ["minecraft:gold_ingot", 2, 4]
        ],
        runes: [
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:heavy_crossbow",
        returns: [
            ["minecraft:iron_nugget", 1, 3],
            ["minecraft:iron_ingot", 1, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:slayer_crossbow",
        returns: [
            ["minecraft:iron_nugget", 1, 3],
            ["minecraft:iron_ingot", 1, 1]
        ],
        runes: [
            "i",
            "r"
        ]
    },
    {
        item: "dungeons:doom_crossbow",
        returns: [
            ["minecraft:iron_nugget", 1, 3],
            ["minecraft:iron_ingot", 1, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:scatter_crossbow",
        returns: [
            ["minecraft:stick", 3, 8],
            ["minecraft:string", 1, 1]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:harp_crossbow",
        returns: [
            ["minecraft:gold_ingot", 3, 8],
            ["minecraft:string", 1, 1]
        ],
        runes: [
            "t",
            "i"
        ]
    },
    {
        item: "dungeons:lightning_harp_crossbow",
        returns: [
            ["minecraft:iron_ingot", 3, 8],
            ["minecraft:string", 1, 1]
        ],
        runes: [
            "t",
            "i"
        ]
    },
    {
        item: "dungeons:shadow_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:chorus_fruit", 0, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:veiled_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:chorus_fruit", 0, 6]
        ],
        runes: [
            "r",
            "c"
        ]
    },
    {
        item: "dungeons:shrieking_crossbow",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "r",
            "c"
        ]
    },
    {
        item: "dungeons:soul_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:lapis_lazuli", 0, 4]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:feral_soul_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:soul_sand", 0, 4]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:voidcaller",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:soul_sand", 0, 4],
            ["minecraft:ender_pearl", 0, 1]
        ],
        runes: [
            "o",
            "a"
        ]
    },
    {
        item: "dungeons:soul_bow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:lapis_lazuli", 0, 2]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:bow_of_lost_souls",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:soul_soil", 0, 2]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:nocturnal_bow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "o",
            "c"
        ]
    },
    {
        item: "dungeons:hunting_bow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:string", 1, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:hunters_promise",
        returns: [
            ["minecraft:stick", 1, 4],
            ["minecraft:string", 1, 2],
            ["minecraft:feather", 1, 1]
        ],
        runes: [
            "r",
            "u"
        ]
    },
    {
        item: "dungeons:masters_bow",
        returns: [
            ["minecraft:stick", 1, 4],
            ["minecraft:string", 1, 2]
        ],
        runes: [
            "r",
            "u"
        ]
    },
    {
        item: "dungeons:ancient_bow",
        returns: [
            ["minecraft:stick", 1, 4],
            ["minecraft:string", 1, 2],
            ["minecraft:web", 0, 1]
        ],
        runes: [
            "c",
            "u"
        ]
    },
    {
        item: "dungeons:burst_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_ingot", 0, 1]
        ],
        runes: [
            "p",
            "r"
        ]
    },
    {
        item: "dungeons:soul_hunter_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraftsoul_sand", 0, 1]
        ],
        runes: [
            "p",
            "r",
            "o"
        ]
    },
    {
        item: "dungeons:corrupted_crossbow",
        returns: [
            ["minecraft:stick", 1, 3],
            ["minecraft:iron_ingot", 0, 1]
        ],
        runes: [
            "p",
            "r",
            "c"
        ]
    },
    //armours
    {
        item: "dungeons:emerald_armour",
        returns: [
            ["minecraft:emerald", 1, 2]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:gilded_glory_armour",
        returns: [
            ["minecraft:emerald", 1, 4],
            ["minecraft:gold_ingot", 0, 2]
        ],
        runes: [
            "a",
            "i"
        ]
    },
    {
        item: "dungeons:opulent_armour",
        returns: [
            ["minecraft:emerald", 1, 4]
        ],
        runes: [
            "a",
            "t"
        ]
    },
    {
        item: "dungeons:entertainers_armour",
        returns: [
            ["minecraft:string", 1, 4]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:troubadour_armour",
        returns: [
            ["minecraft:leather", 1, 4]
        ],
        runes: [
            "s",
            "t"
        ]
    },
    {
        item: "dungeons:evocation_armour",
        returns: [
            ["minecraft:string", 1, 4],
            ["minecraft:gold_nugget", 0, 2]
        ],
        runes: [
            "a",
            "s"
        ]
    },
    {
        item: "dungeons:ember_armour",
        returns: [
            ["minecraft:blaze_powder", 0, 1],
            ["minecraft:gold_nugget", 0, 4]
        ],
        runes: [
            "a",
            "s",
            "i"
        ]
    },
    {
        item: "dungeons:verdant_armour",
        returns: [
            ["minecraft:green_dye", 1, 2],
            ["minecraft:iron_nugget", 0, 4]
        ],
        runes: [
            "a",
            "s",
            "o"
        ]
    },
    {
        item: "dungeons:grim_armour",
        returns: [
            ["minecraft:bone", 1, 2]
        ],
        runes: [
            "s",
            "o"
        ]
    },
    {
        item: "dungeons:wither_armour",
        returns: [
            ["minecraft:bone", 1, 3],
            ["minecraft:coal", 1, 3]
        ],
        runes: [
            "s",
            "o",
            "t"
        ]
    },
    {
        item: "dungeons:spooky_gourdian_armour",
        returns: [
            ["dungeons:diamond_dust", 0.25, 0.25]
        ],
        runes: [
            "s",
            "o",
            "t"
        ]
    },
    {
        item: "dungeons:hunters_armour",
        returns: [
            ["minecraft:leather", 1, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:archers_armour",
        returns: [
            ["minecraft:leather", 1,5 ]
            ["minecraft:gold_ingot", 1,2 ]
        ],
        runes: [
            "c",
            "r"
        ]
    },
    {
        item: "dungeons:guard_armour",
        returns: [
            ["minecraft:leather", 1, 2]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:ender_armour",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
            ["minecraft:ender_pearl", 0, 1]
        ],
        runes: [
            "r",
            "a"
        ]
    },
    {
        item: "dungeons:mercenary_armour",
        returns: [
            ["minecraft:iron_ingot", 1, 3]
        ],
        runes: [
            "s",
            "t"
        ]
    },
    {
        item: "dungeons:renegade_armour",
        returns: [
            ["minecraft:iron_ingot", 2, 5]
        ],
        runes: [
            "s",
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:hungry_horror_armour",
        returns: [
            ["dungeons:diamond_dust", 0.25, 0.25]
        ],
        runes: [
            "s",
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:hungriest_horror_armour",
        returns: [
            ["dungeons:diamond_dust", 0.25, 0.25]
        ],
        runes: [
            "s",
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:ocelot_armour",
        returns: [
            ["minecraft:leather", 0, 1]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:shadow_walker_armour",
        returns: [
            ["minecraft:leather", 0, 1],
            ["minecraft:gold_ingot", 0, 2]
        ],
        runes: [
            "c",
            "t"
        ]
    },
    {
        item: "dungeons:piglin_armour",
        returns: [
            ["minecraft:leather", 1, 2],
            ["minecraft:gold_ingot", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:golden_piglin_armour",
        returns: [
            ["minecraft:leather", 1, 2],
            ["minecraft:gold_ingot", 2, 3]
        ],
        runes: [
            "a",
            "s"
        ]
    },
    {
        item: "dungeons:root_rot_armour",
        returns: [
            ["minecraft:moss_block", 0, 2]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:black_spot_armour",
        returns: [
            ["minecraft:pale_moss_block", 0, 3]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:shulker_armour",
        returns: [
            ["minecraft:shulker_shell", 0, 2]
        ],
        runes: [
            "i",
            "t"
        ]
    },
    {
        item: "dungeons:sturdy_shulker_armour",
        returns: [
            ["minecraft:shulker_shell", 0, 2]
        ],
        runes: [
            "i",
            "t",
            "s"
        ]
    },
    {
        item: "dungeons:snow_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:frost_armour",
        returns: [
            ["minecraft:blue_ice", 1, 3]
        ],
        runes: [
            "t",
            "s"
        ]
    },
    {
        item: "dungeons:soul_armour",
        returns: [
            ["minecraft:lapis_lazuli", 1, 2],
            ["minecraft:leather", 0, 2]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:souldancer_armour",
        returns: [
            ["minecraft:lapis_lazuli", 1, 2],
            ["minecraft:leather", 0, 2]
        ],
        runes: [
            "o",
            "t"
        ]
    },
    {
        item: "dungeons:spelunker_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 2],
            ["minecraft:coal", 0, 1]
        ],
        runes: [
            "u"
        ]
    },
    {
        item: "dungeons:cave_crawler_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 3],
            ["minecraft:iron_nugget", 0, 7]
        ],
        runes: [
            "u",
            "i"
        ]
    },
    {
        item: "dungeons:sweet_tooth_armour",
        returns: [
            ["dungeons:diamond_dust", 0.25, 0.25]
        ],
        runes: [
            "u",
            "i"
        ]
    },
    {
        item: "dungeons:sprout_armour",
        returns: [
            ["minecraft:nether_sprouts", 0, 3]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:living_vines_armour",
        returns: [
            ["minecraft:weeping_vines", 0, 3]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:thief_armour",
        returns: [
            ["minecraft:gunpowder", 0, 2]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:spider_armour",
        returns: [
            ["minecraft:string", 0, 2]
        ],
        runes: [
            "i",
            "t"
        ]
    },
    {
        item: "dungeons:teleportation_armour",
        returns: [
            ["minecraft:ender_pearl", 0, 2],
            ["minecraft:gold_ingot", 0, 2]
        ],
        runes: [
            "a",
            "o"
        ]
    },
    {
        item: "dungeons:unstable_armour",
        returns: [
            ["minecraft:ender_pearl", 0, 2],
            ["minecraft:diamond", 0, 0.5]
        ],
        runes: [
            "a",
            "o",
            "c"
        ]
    },
    {
        item: "dungeons:turtle_armour",
        returns: [
            ["minecraft:turtle_scute", 0, 2]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:nimble_turtle_armour",
        returns: [
            ["minecraft:turtle_scute", 0, 2]
        ],
        runes: [
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:wolf_armour",
        returns: [
            ["minecraft:bone", 0, 1],
            ["minecraft:leather", 0, 1]
        ],
        runes: [
            "s",
            "u"
        ]
    },
    {
        item: "dungeons:black_wolf_armour",
        returns: [
            ["minecraft:bone", 0, 1],
            ["minecraft:black_dye", 0, 1]
        ],
        runes: [
            "s",
            "u",
            "c"
        ]
    },
    {
        item: "dungeons:fox_armour",
        returns: [
            ["minecraft:sweet_berries", 0, 1],
            ["minecraft:leather", 0, 1]
        ],
        runes: [
            "s",
            "u",
            "c"
        ]
    },
    {
        item: "dungeons:phantom_armour",
        returns: [
            ["minecraft:phantom_membrane", 0, 1]
        ],
        runes: [
            "o",
            "r"
        ]
    },
    {
        item: "dungeons:frost_bite_armour",
        returns: [
            ["minecraft:phantom_membrane", 0, 2],
            ["minecraft:snowball", 0, 2]
        ],
        runes: [
            "o",
            "r",
            "s"
        ]
    },
    {
        item: "dungeons:mystery_armour",
        returns: [
            ["minecraft:diamond", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_red",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:redstone", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_orange",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:resin_brick", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_green",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:emerald", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_light_blue",
        returns: [
            ["minecraft:diamond", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_blue",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:lapis_lazuli", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_purple",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:amethyst_shard", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_pink",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:amethyst_shard", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_black",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:coal", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:mystery_armour_white",
        returns: [
            ["minecraft:diamond", 0, 1]
            ["minecraft:quartz", 0, 1]
        ],
        runes: [
            "a",
            "p"
        ]
    },
    {
        item: "dungeons:plate_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 4]
        ],
        runes: [
            "i",
            "t"
        ]
    },
    {
        item: "dungeons:full_metal_armour",
        returns: [
            ["minecraft:iron_ingot", 2, 6],
            ["minecraft:goldd_ingot", 0, 2]
        ],
        runes: [
            "i",
            "t"
        ]
    },
    {
        item: "dungeons:cauldron_armour",
        returns: [
            ["dungeons:diamond_dust", 0.25, 0.25]
        ],
        runes: [
            "t",
            "i"
        ]
    },
    {
        item: "dungeons:squid_armour",
        returns: [
            ["minecraft:ink_sac", 0, 2]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:glow_squid_armour",
        returns: [
            ["minecraft:glow_ink_sac", 0, 2]
        ],
        runes: [
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:battle_armour",
        returns: [
            ["minecraft:gold_ingot", 0, 2]
        ],
        runes: [
            "a",
            "i"
        ]
    },
    {
        item: "dungeons:splendid_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "a",
            "i",
            "r"
        ]
    },
    {
        item: "dungeons:champions_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 3]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:heros_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 5],
            ["minecraft:gold_ingot", 0, 3]
        ],
        runes: [
            "t",
            "s"
        ]
    },
    {
        item: "dungeons:reinforced_mail_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 3],
            ["minecraft:chain", 0, 3]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:stalwart_armour",
        returns: [
            ["minecraft:iron_ingot", 2, 5],
            ["minecraft:chain", 0, 3]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:dark_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 5]
        ],
        runes: [
            "o",
            "t"
        ]
    },
    {
        item: "dungeons:titans_shroud_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 5],
            ["minecraft:diamond", 0, 0.5]
        ],
        runes: [
            "o",
            "t",
            "s"
        ]
    },
    {
        item: "dungeons:scale_mail_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 2]
        ],
        runes: [
            "i",
            "t"
        ]
    },
    {
        item: "dungeons:highland_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 5]
        ],
        runes: [
            "i",
            "t",
            "c"
        ]
    },
    {
        item: "dungeons:ghostly_armour",
        returns: [
            ["minecraft:iron_ingot", 0, 3]
        ],
        runes: [
            "c",
            "p"
        ]
    },
    {
        item: "dungeons:ghost_kindler_armour",
        returns: [
            ["minecraft:gold_ingot", 0, 3]
        ],
        runes: [
            "c",
            "p",
            "i"
        ]
    },
    {
        item: "dungeons:cloaked_skull_armour",
        returns: [
            ["dungeons:diamond_dust", 0.25, 0.25]
        ],
        runes: [
            "c",
            "p",
            "i"
        ]
    },
    {
        item: "dungeons:beenest_armour",
        returns: [
            ["minecraft:honeycomb", 0, 1]
        ],
        runes: [
            "p",
            "u"
        ]
    },
    {
        item: "dungeons:beehive_armour",
        returns: [
            ["minecraft:honeycomb", 1, 3],
            ["minecraft:oak_planks", 1, 3]
        ],
        runes: [
            "p",
            "u",
            "i"
        ]
    },
    {
        item: "dungeons:climbing_armour",
        returns: [
            ["minecraft:leather", 0, 2]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:rugged_climbing_armour",
        returns: [
            ["minecraft:leather", 1, 4]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:goat_armour",
        returns: [
            ["minecraft:leather", 0, 2],
            ["minecraft:goat_horn", 0, 0.5]
        ],
        runes: [
            "t",
            "c"
        ]
    },
    //artefacts
    {
        item: "dungeons:blast_fungus",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:boots_of_swiftness",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:buzzy_nest",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "u"
        ]
    },
    {
        item: "dungeons:corrupted_beacon",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:corrupted_pumpkin",
        returns: [
            ["dungeons:diamond_dust", 1, 1]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:corrupted_seeds",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:death_cap_mushroom",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:enchanted_grass",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a",
            "u"
        ]
    },
    {
        item: "dungeons:enchanters_tome",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:eye_of_the_guardian",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:ghost_cloak",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "c",
            "t"
        ]
    },
    {
        item: "dungeons:golem_kit",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "u"
        ]
    },
    {
        item: "dungeons:gong_of_weakening",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:harvester",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:ice_wand",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:iron_hide_amulet",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "t"
        ]
    },
    {
        item: "dungeons:light_feather",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "c"
        ]
    },
    {
        item: "dungeons:lightning_rod",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:love_medallion",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:powershaker",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:satchel_of_elements",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:satchel_of_elixirs",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:satchel_of_snacks",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:scatter_mines",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:shadow_shifter",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:shock_powder",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s",
            "t"
        ]
    },
    {
        item: "dungeons:reeling_rod",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:torment_quiver",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "r",
            "o"
        ]
    },
    {
        item: "dungeons:firework_quiver",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:flaming_quiver",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:thundering_quiver",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:harpoon_quiver",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:void_quiver",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "r"
        ]
    },
    {
        item: "dungeons:soul_healer",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o",
            "s"
        ]
    },
    {
        item: "dungeons:soul_lantern",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o",
            "u"
        ]
    },
    {
        item: "dungeons:spinblade",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "i"
        ]
    },
    {
        item: "dungeons:tasty_bone",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "u"
        ]
    },
    {
        item: "dungeons:tome_of_duplication",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:totem_of_casting",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o"
        ]
    },
    {
        item: "dungeons:totem_of_soul_protection",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "o",
            "a"
        ]
    },
    {
        item: "dungeons:totem_of_regeneration",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s"
        ]
    },
    {
        item: "dungeons:totem_of_shielding",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s",
            "t"
        ]
    },
    {
        item: "dungeons:updraft_tome",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "a"
        ]
    },
    {
        item: "dungeons:vexing_chant",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "u"
        ]
    },
    {
        item: "dungeons:wind_horn",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "s",
            "u"
        ]
    },
    {
        item: "dungeons:wonderful_wheat",
        returns: [
            ["dungeons:diamond_dust", 0, 1]
        ],
        runes: [
            "u"
        ]
    },
    {
        item: "dungeons:alylicleaver",
        returns: [
            ["minecraft:axolotl_spawn_egg", 1, 1]
        ],
        runes: [
            "a",
            "c",
            "p"
        ]
    }
]