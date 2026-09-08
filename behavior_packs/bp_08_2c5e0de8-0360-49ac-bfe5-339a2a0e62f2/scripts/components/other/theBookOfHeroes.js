import {
    world,
    system,
    ItemStack
} from "@minecraft/server";
import {
    ActionFormData
} from "@minecraft/server-ui";

function getCount(player, type) {
    var looKThrough
    if (type == "melee") looKThrough = weaponData
    if (type == "ranged") looKThrough = bowData
    if (type == "armour") looKThrough = armourData
    if (type == "artefact") looKThrough = artefactData
    if (type == "all") {
        looKThrough = []
        for (const element of weaponData) looKThrough.push(element)
        for (const element of bowData) looKThrough.push(element)
        for (const element of armourData) looKThrough.push(element)
        for (const element of artefactData) looKThrough.push(element)
    }
    var count = 0
    var max = 0
    for (let element of looKThrough) {
        const id = element.id;
        if (element.seasonal) {
            if (player.hasTag("boh_collected:" + id)) {
                max += 1
                count += 1
            }
        } else {
            max += 1
            if (player.hasTag("boh_collected:" + id)) count += 1
        }
    }
    return [count, max, percentageColour(count, max)]
}

function generateWeaponPage(weaponId) {
    const weapon = weaponData.find(item => item.id === weaponId);
    if (!weapon) return undefined;
    let page = new ActionFormData();
    page.title(makeTitle(weaponId));
    page.body(makeBody(weaponId));
    if (weapon.seasonal == true) page.label({ rawtext: [{ translate: "dungeons.boh.seasonal_item" }] })

    page.divider()
    page.label(getDamage(weapon))
    page.label(getDurability(weapon))
    page.divider()
    for (let i = 0; i < weapon.effects.length; i++) {
        const effect = weapon.effects[i]
        if (i + 1 == weapon.effects.length) {
            page.label(makeEffect(effect, true))
        } else {
            page.label(makeEffect(effect, false))
        }
    }
    if (weapon.effects.length > 0) page.divider()
    page.button({ translate: "dungeons.boh.close" })
    return page
}

function generateRangedPage(weaponId) {
    const weapon = bowData.find(item => item.id === weaponId);
    if (!weapon) return undefined;
    let page = new ActionFormData();
    page.title(makeTitle(weaponId));
    page.body(makeBody(weaponId));
    if (weapon.seasonal == true) page.label({ rawtext: [{ translate: "dungeons.boh.seasonal_item" }] })

    page.divider()
    page.label(getDrawTime(weapon))
    page.label(getDurability(weapon))
    page.divider()
    for (let i = 0; i < weapon.effects.length; i++) {
        const effect = weapon.effects[i]
        if (i + 1 == weapon.effects.length) {
            page.label(makeEffect(effect, true))
        } else {
            page.label(makeEffect(effect, false))
        }
    }
    if (weapon.effects.length > 0) page.divider()
    page.button({ translate: "dungeons.boh.close" })
    return page
}

function generateArmourPage(weaponId) {
    const weapon = armourData.find(item => item.id === weaponId);
    if (!weapon) return undefined;
    let page = new ActionFormData();
    page.title(makeTitle(weaponId));
    page.body(makeBody(weaponId));
    if (weapon.seasonal == true) page.label({ rawtext: [{ translate: "dungeons.boh.seasonal_item" }] })

    page.divider()
    page.label(getProtection(weapon))
    page.label(getDurabilityAverage(weaponId))
    page.divider()
    for (let i = 0; i < weapon.effects.length; i++) {
        const effect = weapon.effects[i]
        if (i + 1 == weapon.effects.length) {
            page.label(makeEffect(effect, true))
        } else {
            page.label(makeEffect(effect, false))
        }
    }
    if (weapon.effects.length > 0) page.divider()
    page.button({ translate: "dungeons.boh.close" })
    return page
}

function generateArtefactPage(weaponId) {
    const weapon = artefactData.find(item => item.id === weaponId);
    if (!weapon) return undefined;
    let page = new ActionFormData();
    page.title(makeTitle(weaponId));
    page.body(makeBody(weaponId));
    if (weapon.seasonal == true) page.label({ rawtext: [{ translate: "dungeons.boh.seasonal_item" }] })
    page.divider()
    if (weapon.seasonal == false) {
        const cooldown = new ItemStack(weaponId, 1)
        const r_cooldown = new ItemStack("dungeons:rare_" + weaponId.replace("dungeons:", ""), 1)
        const cd1Ticks = cooldown.getComponent("cooldown").cooldownTicks / 20
        const cd2Ticks = r_cooldown.getComponent("cooldown").cooldownTicks / 20
        if (cd1Ticks == cd2Ticks) {
            page.label(getCooldown(cd1Ticks, false))
        } else {
            page.label(getCooldown(cd1Ticks, false))
            page.label(getCooldown(cd2Ticks, true))

        }
    } else {
        const cooldown = new ItemStack(weaponId, 1)
        const cd1Ticks = cooldown.getComponent("cooldown").cooldownTicks / 20
        page.label(getCooldown(cd1Ticks, false))

    }
    if (weapon.souls !== 0) page.label(getSoulCost(weapon))
    page.divider()
    for (let i = 0; i < weapon.lines; i++) {
        const effect = weaponId.replace("dungeons:", "") + "." + `${i}`
        if (i + 1 == weapon.lines) {
            page.label(makeEffect(effect, true))
        } else {
            page.label(makeEffect(effect, false))
        }
    }
    if (weapon.lines > 0) page.divider()
    page.button({ translate: "dungeons.boh.close" })
    return page
}


system.beforeEvents.startup.subscribe((e) => {
    e.itemComponentRegistry.registerCustomComponent('dungeons:book_of_heroes', {
        onUse(e) {
            showRootPage(e.source)
        }
    })
})

function showRootPage(player) {
    let page = new ActionFormData();
    const meleeCountData = getCount(player, "melee")
    const rangedCountData = getCount(player, "ranged")
    const armourCountData = getCount(player, "armour")
    const artefactCountData = getCount(player, "artefact")
    const allCountData = getCount(player, "all")
    page.title({ translate: "dungeons.boh.root.title" });
    page.body({ rawtext: [{ translate: "dungeons.boh.root.body" }, { text: "\n\n" }, { translate: "dungeons.boh.collected" }, { text: `${allCountData[2]} ${allCountData[0]}/${allCountData[1]}` }] });
    page.divider()
    page.button({ rawtext: [{ translate: "dungeons.boh.root.weapons" }, { text: `${meleeCountData[2]} ${meleeCountData[0]}/${meleeCountData[1]}` }] }, "textures/ui/form/melee");
    page.divider()
    page.button({ rawtext: [{ translate: "dungeons.boh.root.ranged" }, { text: `${rangedCountData[2]} ${rangedCountData[0]}/${rangedCountData[1]}` }] }, "textures/ui/form/ranged");
    page.divider()
    page.button({ rawtext: [{ translate: "dungeons.boh.root.armour" }, { text: `${armourCountData[2]} ${armourCountData[0]}/${armourCountData[1]}` }] }, "textures/ui/form/armor");
    page.divider()
    page.button({ rawtext: [{ translate: "dungeons.boh.root.artefacts" }, { text: `${artefactCountData[2]} ${artefactCountData[0]}/${artefactCountData[1]}` }] }, "textures/ui/form/artefact");
    page.show(player).then(r => {
        player.playSound('item.book.page_turn');
        if (r.canceled) return;
        if (r.selection == 0) showTypesPage(player, "melee")
        if (r.selection == 1) showTypesPage(player, "ranged")
        if (r.selection == 2) showTypesPage(player, "armour")
        if (r.selection == 3) showCategory(player, "artefact", artefactData, "artefact")
    }).catch(e => {
        console.error(e, e.stack);
    });
}

function showTypesPage(player, type) {
    let page = new ActionFormData();
    var searchThrough
    var buttonArray = []
    if (type == "melee") searchThrough = weaponData
    if (type == "ranged") searchThrough = bowData
    if (type == "armour") searchThrough = armourData
    if (type == "artefact") searchThrough = artefactData
    const countData = getCount(player, type)
    page.title({ translate: "dungeons.boh." + type + ".title" });
    page.body({ translate: "dungeons.boh." + type + ".body" });
    page.label({ rawtext: [{ translate: "dungeons.boh.collected" }, { text: `${countData[2]} ${countData[0]}/${countData[1]}` }] })
    for (const element of searchThrough) {
        if (buttonArray.includes(element.type)) continue;
        if (player.hasTag("boh_collected:dungeons:" + element.type)) {
            page.divider()
            page.button({ translate: "dungeons.boh.category." + element.type.replace("_armour", "") }, "textures/ui/form/" + type + "/" + element.type.replace("_armour", ""));
            buttonArray.push(element.type)
        }
    }
    for (const element of searchThrough) {
        if (buttonArray.includes(element.type)) continue;
        if (!player.hasTag("boh_collected:dungeons:" + element.type)) {
            page.divider()
            page.button({ rawtext: [{ text: "§7" }, { translate: "dungeons.boh.category." + element.type.replace("_armour", "") }] }, "textures/ui/form/" + type + "/locked/" + element.type.replace("_armour", ""));
            buttonArray.push(element.type)
        }
    }
    page.divider()
    page.show(player).then(r => {
        player.playSound('item.book.page_turn');
        if (r.canceled) {
            return;
        }
        if (!player.hasTag("boh_collected:dungeons:" + buttonArray[r.selection])) {
            return player.sendMessage({ translate: "dungeons.boh.locked_category" })
        }
        showCategory(player, buttonArray[r.selection], searchThrough, type)
    }).catch(e => {
        console.error(e, e.stack);
    });
}

function showCategory(player, category, searchThrough, type) {
    let page = new ActionFormData();
    var buttonArray = []

    page.title({ translate: "dungeons.boh.category." + category.replace("_armour", "") });
    page.body({ translate: "dungeons.boh.category_body." + category.replace("_armour", "") });
    for (const element of searchThrough) {
        if (buttonArray.includes(element.id)) continue;
        if (element.type !== category) continue;
        if (player.hasTag("boh_collected:" + element.id)) {
            page.divider()
            page.button(makeTitle(element.id), "textures/ui/form/" + type + "/" + element.id.replace("dungeons:", "").replace("_armour", ""));
            buttonArray.push(element.id)
        }
    }
    for (const element of searchThrough) {
        if (buttonArray.includes(element.id)) continue;
        if (element.type !== category) continue;
        if (element.seasonal == false) {
            if (!player.hasTag("boh_collected:" + element.id)) {
                page.divider()
                page.button(makeTitle(element.id, "§7"), "textures/ui/form/" + type + "/locked/" + element.id.replace("dungeons:", "").replace("_armour", ""));
                buttonArray.push(element.id)
            }
        }
    }
    page.divider()
    page.show(player).then(r => {
        player.playSound('item.book.page_turn');
        if (r.canceled && type !== "artefact") showTypesPage(player, type);
        var page2
        if (type == "melee") page2 = generateWeaponPage(buttonArray[r.selection])
        if (type == "ranged") page2 = generateRangedPage(buttonArray[r.selection])
        if (type == "armour") page2 = generateArmourPage(buttonArray[r.selection])
        if (type == "artefact") page2 = generateArtefactPage(buttonArray[r.selection])
        if (!page2) return;
        if (!player.hasTag("boh_collected:" + buttonArray[r.selection])) {
            return player.sendMessage({ translate: "dungeons.boh.locked_item" })
        }
        page2.show(player).then(r => {
            player.playSound('item.book.page_turn');
            if (r.canceled) showCategory(player, category, searchThrough, type);
        }).catch(e => {
            console.error(e, e.stack);
        });
    }).catch(e => {
        console.error(e, e.stack);
    });
}

//item data

export const weaponData = [
    {
        id: "dungeons:longsword",
        type: "longsword",
        seasonal: false,
        damage: 6,
        durability: 1320,
        effects: [
            "blocks_attacks"
        ]
    },
    {
        id: "dungeons:diamond_longsword",
        type: "longsword",
        seasonal: false,
        damage: 7,
        durability: 1320,
        effects: [
            "blocks_attacks",
            "sharpened"
        ]
    },
    {
        id: "dungeons:hawkbrand",
        type: "longsword",
        seasonal: false,
        damage: 7,
        durability: 1320,
        effects: [
            "blocks_attacks",
            "critical_hit"
        ]
    },
    {
        id: "dungeons:sinister_sword",
        type: "longsword",
        seasonal: true,
        damage: 7,
        durability: 1320,
        effects: [
            "blocks_attacks",
            "critical_hit"
        ]
    },
    {
        id: "dungeons:katana",
        type: "katana",
        seasonal: false,
        damage: 7,
        durability: 119,
        effects: [

        ]
    },
    {
        id: "dungeons:masters_katana",
        type: "katana",
        seasonal: false,
        damage: 8,
        durability: 1119,
        effects: [
            "critical_hit"
        ]
    },
    {
        id: "dungeons:dark_katana",
        type: "katana",
        seasonal: false,
        damage: 8,
        durability: 1119,
        effects: [
            "smiting"
        ]
    },
    {
        id: "dungeons:claymore",
        type: "claymore",
        seasonal: false,
        damage: 7,
        durability: 555,
        effects: [
            "knockback"
        ]
    },
    {
        id: "dungeons:broadsword",
        type: "claymore",
        seasonal: false,
        damage: 8,
        durability: 1861,
        effects: [
            "knockback",
            "sharpened"
        ]
    },
    {
        id: "dungeons:great_axeblade",
        type: "claymore",
        seasonal: false,
        damage: 8,
        durability: 1861,
        effects: [
            "knockback",
            "swirling"
        ]
    },
    {
        id: "dungeons:heartstealer",
        type: "claymore",
        seasonal: false,
        damage: 8,
        durability: 1861,
        effects: [
            "knockback",
            "leeching"
        ]
    },
    {
        id: "dungeons:cutlass",
        type: "cutlass",
        seasonal: false,
        damage: 7,
        durability: 210,
        effects: [
            "disarms_shields"
        ]
    },
    {
        id: "dungeons:nameless_blade",
        type: "cutlass",
        seasonal: false,
        damage: 8,
        durability: 1320,
        effects: [
            "disarms_shields",
            "weakening"
        ]
    },
    {
        id: "dungeons:dancers_sword",
        type: "cutlass",
        seasonal: false,
        damage: 8,
        durability: 1320,
        effects: [
            "disarms_shields",
            "rampaging"
        ]
    },

    {
        id: "dungeons:sparkler",
        type: "cutlass",
        seasonal: true,
        damage: 8,
        durability: 1320,
        effects: [
            "disarms_shields",
            "rampaging"
        ]
    },
    {
        id: "dungeons:daggers",
        type: "daggers",
        seasonal: false,
        damage: 4,
        durability: 180,
        effects: [
            "double_hit"
        ]
    },
    {
        id: "dungeons:frost_knives",
        type: "daggers",
        seasonal: false,
        damage: 6,
        durability: 1153,
        effects: [
            "double_hit",
            "freezing"
        ]
    },
    {
        id: "dungeons:moon_daggers",
        type: "daggers",
        seasonal: false,
        damage: 6,
        durability: 1153,
        effects: [
            "double_hit",
            "enigma_resonator"
        ]
    },
    {
        id: "dungeons:sheer_daggers",
        type: "daggers",
        seasonal: false,
        damage: 6,
        durability: 1153,
        effects: [
            "double_hit",
            "swirling"
        ]
    },
    {
        id: "dungeons:rapier",
        type: "rapier",
        seasonal: false,
        damage: 6,
        durability: 133,
        effects: [
            "sweeping"
        ]
    },
    {
        id: "dungeons:freezing_foil",
        type: "rapier",
        seasonal: false,
        damage: 7,
        durability: 1011,
        effects: [
            "sweeping",
            "freezing"
        ]
    },
    {
        id: "dungeons:bee_stinger",
        type: "rapier",
        seasonal: false,
        damage: 7,
        durability: 1011,
        effects: [
            "sweeping",
            "busy_bee"
        ]
    },
    {
        id: "dungeons:sickles",
        type: "sickles",
        seasonal: false,
        damage: 4,
        durability: 210,
        effects: [
            "double_hit",
            "scythe"
        ]
    },
    {
        id: "dungeons:the_last_laugh",
        type: "sickles",
        seasonal: false,
        damage: 5,
        durability: 1223,
        effects: [
            "double_hit",
            "scythe",
            "prospector"
        ]
    },
    {
        id: "dungeons:nightmares_bite",
        type: "sickles",
        seasonal: false,
        damage: 5,
        durability: 1223,
        effects: [
            "double_hit",
            "scythe",
            "poison_cloud"
        ]
    },
    {
        id: "dungeons:glaive",
        type: "glaive",
        seasonal: false,
        damage: 7,
        durability: 322,
        effects: [
            "sweeping"
        ]
    },
    {
        id: "dungeons:grave_bane",
        type: "glaive",
        seasonal: false,
        damage: 8,
        durability: 1599,
        effects: [
            "sweeping",
            "smiting"
        ]
    },
    {
        id: "dungeons:venom_glaive",
        type: "glaive",
        seasonal: false,
        damage: 8,
        durability: 1599,
        effects: [
            "sweeping",
            "poison_cloud"
        ]
    },
    {
        id: "dungeons:cackling_broom",
        type: "glaive",
        seasonal: true,
        damage: 8,
        durability: 1599,
        effects: [
            "sweeping",
            "smiting"
        ]
    },
    {
        id: "dungeons:battlestaff",
        type: "battlestaff",
        seasonal: false,
        damage: 4,
        durability: 100,
        effects: [
            "battlestaff_sweeping"
        ]
    },
    {
        id: "dungeons:battlestaff_of_terror",
        type: "battlestaff",
        seasonal: false,
        damage: 5,
        durability: 800,
        effects: [
            "battlestaff_sweeping",
            "exploding"
        ]
    },
    {
        id: "dungeons:growing_staff",
        type: "battlestaff",
        seasonal: false,
        damage: 5,
        durability: 800,
        effects: [
            "battlestaff_sweeping",
            "committed"
        ]
    },
    {
        id: "dungeons:sharpened_pickaxe",
        type: "sharpened_pickaxe",
        seasonal: false,
        damage: 5,
        durability: 362,
        effects: [
            "golem_damage"
        ]
    },
    {
        id: "dungeons:sharpened_diamond_pickaxe",
        type: "sharpened_pickaxe",
        seasonal: false,
        damage: 5,
        durability: 1603,
        effects: [
            "golem_damage",
            "prospector"
        ]
    },
    {
        id: "dungeons:the_monkey_motivator",
        type: "sharpened_pickaxe",
        seasonal: false,
        damage: 6,
        durability: 1603,
        effects: [
            "golem_damage",
            "rampaging"
        ]
    },
    {
        id: "dungeons:cleaving_axe",
        type: "cleaving_axe",
        seasonal: false,
        damage: 6,
        durability: 289,
        effects: [
            "disarms_shields"
        ]
    },
    {
        id: "dungeons:firebrand",
        type: "cleaving_axe",
        seasonal: false,
        damage: 7,
        durability: 1622,
        effects: [
            "disarms_shields",
            "fire_aspect"
        ]
    },
    {
        id: "dungeons:highland_axe",
        type: "cleaving_axe",
        seasonal: false,
        damage: 7,
        durability: 1622,
        effects: [
            "disarms_shields",
            "stunning"
        ]
    },
    {
        id: "dungeons:double_axe",
        type: "double_axe",
        seasonal: false,
        damage: 6,
        durability: 400,
        effects: [
            "swirling"
        ]
    },
    {
        id: "dungeons:cursed_axe",
        type: "double_axe",
        seasonal: false,
        damage: 7,
        durability: 1739,
        effects: [
            "swirling",
            "exploding"
        ]
    },
    {
        id: "dungeons:whirlwind",
        type: "double_axe",
        seasonal: false,
        damage: 7,
        durability: 1739,
        effects: [
            "swirling",
            "shockwave"
        ]
    },
    {
        id: "dungeons:rush_spear",
        type: "rush_spear",
        seasonal: false,
        damage: 3,
        durability: 244,
        effects: [
            "charge_attack"
        ]
    },
    {
        id: "dungeons:fortune_spear",
        type: "rush_spear",
        seasonal: false,
        damage: 4,
        durability: 1244,
        effects: [
            "charge_attack",
            "looting"
        ]
    },
    {
        id: "dungeons:whispering_spear",
        type: "rush_spear",
        seasonal: false,
        damage: 4,
        durability: 1244,
        effects: [
            "charge_attack",
            "echo"
        ]
    },
    {
        id: "dungeons:coral_blade",
        type: "coral_blade",
        seasonal: false,
        damage: 5,
        durability: 115,
        effects: [
            "water_damage"
        ]
    },
    {
        id: "dungeons:sponge_striker",
        type: "coral_blade",
        seasonal: false,
        damage: 6,
        durability: 715,
        effects: [
            "water_damage",
            "damage_absorption"
        ]
    },
    {
        id: "dungeons:tempest_knife",
        type: "tempest_knife",
        seasonal: false,
        damage: 6,
        durability: 206,
        effects: [
            "rushdown"
        ]
    },
    {
        id: "dungeons:chill_gale_knife",
        type: "tempest_knife",
        seasonal: false,
        damage: 7,
        durability: 1237,
        effects: [
            "rushdown",
            "freezing"
        ]
    },
    {
        id: "dungeons:resolute_tempest_knife",
        type: "tempest_knife",
        seasonal: false,
        damage: 7,
        durability: 1237,
        effects: [
            "rushdown",
            "committed"
        ]
    },
    {
        id: "dungeons:soul_knife",
        type: "soul_knife",
        seasonal: false,
        damage: 6,
        durability: 412,
        effects: [
        ]
    },
    {
        id: "dungeons:eternal_knife",
        type: "soul_knife",
        seasonal: false,
        damage: 7,
        durability: 1666,
        effects: [
            "soul_siphon"
        ]
    },
    {
        id: "dungeons:truthseeker",
        type: "soul_knife",
        seasonal: false,
        damage: 7,
        durability: 1666,
        effects: [
            "committed"
        ]
    },
    {
        id: "dungeons:soul_scythe",
        type: "soul_scythe",
        seasonal: false,
        damage: 7,
        durability: 699,
        effects: [
            "scythe"
        ]
    },
    {
        id: "dungeons:frost_scythe",
        type: "soul_scythe",
        seasonal: false,
        damage: 8,
        durability: 1722,
        effects: [
            "scythe",
            "freezing"
        ]
    },
    {
        id: "dungeons:jailors_scythe",
        type: "soul_scythe",
        seasonal: false,
        damage: 8,
        durability: 1722,
        effects: [
            "scythe",
            "chains"
        ]
    },
    {
        id: "dungeons:skull_scythe",
        type: "soul_scythe",
        seasonal: true,
        damage: 8,
        durability: 1722,
        effects: [
            "scythe",
            "freezing"
        ]
    },
    {
        id: "dungeons:gauntlets",
        type: "gauntlets",
        seasonal: false,
        damage: 5,
        durability: 300,
        effects: [
            "double_hit"
        ]
    },
    {
        id: "dungeons:fighters_bindings",
        type: "gauntlets",
        seasonal: false,
        damage: 7,
        durability: 1222,
        effects: [
            "triple_hit"
        ]
    },
    {
        id: "dungeons:maulers",
        type: "gauntlets",
        seasonal: false,
        damage: 7,
        durability: 1222,
        effects: [
            "double_hit",
            "rampaging"
        ]
    },
    {
        id: "dungeons:soul_fists",
        type: "gauntlets",
        seasonal: false,
        damage: 7,
        durability: 1222,
        effects: [
            "double_hit",
            "enigma_resonator"
        ]
    },
    {
        id: "dungeons:whip",
        type: "whip",
        seasonal: false,
        damage: 5,
        durability: 177,
        effects: [
            "stronger_at_range",
            "area_damage"
        ]
    },
    {
        id: "dungeons:vine_whip",
        type: "whip",
        seasonal: false,
        damage: 6,
        durability: 1239,
        effects: [
            "stronger_at_range",
            "area_damage",
            "poison"
        ]
    },
    {
        id: "dungeons:broken_sawblade",
        type: "broken_sawblade",
        seasonal: false,
        damage: 5,
        durability: 150,
        effects: [
            "sawblade",
            "high_overheat_chance"
        ]
    },
    {
        id: "dungeons:mechanised_sawblade",
        type: "broken_sawblade",
        seasonal: false,
        damage: 6,
        durability: 912,
        effects: [
            "sawblade",
            "low_overheat_chance"
        ]
    },
    {
        id: "dungeons:great_hammer",
        type: "great_hammer",
        seasonal: false,
        damage: 8,
        durability: 1120,
        effects: [
            "area_damage"
        ]
    },
    {
        id: "dungeons:hammer_of_gravity",
        type: "great_hammer",
        seasonal: false,
        damage: 10,
        durability: 2004,
        effects: [
            "area_damage",
            "gravity"
        ]
    },
    {
        id: "dungeons:stormlander",
        type: "great_hammer",
        seasonal: false,
        damage: 10,
        durability: 2004,
        effects: [
            "area_damage",
            "thundering"
        ]
    },
    {
        id: "dungeons:bonehead_hammer",
        type: "great_hammer",
        seasonal: true,
        damage: 10,
        durability: 2004,
        effects: [
            "area_damage",
            "gravity"
        ]
    },
    {
        id: "dungeons:iron_mace",
        type: "iron_mace",
        seasonal: false,
        damage: 7,
        durability: 512,
        effects: [
            "critical_boost"
        ]
    },
    {
        id: "dungeons:suns_grace",
        type: "iron_mace",
        seasonal: false,
        damage: 8,
        durability: 1912,
        effects: [
            "critical_boost",
            "radiance"
        ]
    },
    {
        id: "dungeons:flail",
        type: "iron_mace",
        seasonal: false,
        damage: 8,
        durability: 1912,
        effects: [
            "critical_boost",
            "chains"
        ]
    },
    {
        id: "dungeons:anchor",
        type: "anchor",
        seasonal: false,
        damage: 15,
        durability: 1341,
        effects: [
            "area_damage",
            "gravity"
        ]
    },
    {
        id: "dungeons:encrusted_anchor",
        type: "anchor",
        seasonal: false,
        damage: 18,
        durability: 1957,
        effects: [
            "area_damage",
            "gravity",
            "poison"
        ]
    },
    {
        id: "dungeons:boneclub",
        type: "boneclub",
        seasonal: false,
        damage: 9,
        durability: 800,
        effects: [
            "knockback"
        ]
    },
    {
        id: "dungeons:bone_cudgel",
        type: "boneclub",
        seasonal: false,
        damage: 11,
        durability: 1963,
        effects: [
            "knockback",
            "illagers_bane"
        ]
    },
    {
        id: "dungeons:backstabber",
        type: "backstabber",
        seasonal: false,
        damage: 5,
        durability: 401,
        effects: [
            "ambush"
        ]
    },
    {
        id: "dungeons:swift_striker",
        type: "backstabber",
        seasonal: false,
        damage: 6,
        durability: 1621,
        effects: [
            "ambush",
            "echo"
        ]
    },
    {
        id: "dungeons:void_touched_blades",
        type: "void_touched_blades",
        seasonal: false,
        damage: 4,
        durability: 333,
        effects: [
            "double_hit",
            "void_strike"
        ]
    },
    {
        id: "dungeons:the_beginning_and_the_end",
        type: "void_touched_blades",
        seasonal: false,
        damage: 6,
        durability: 2033,
        effects: [
            "double_hit",
            "void_strike",
            "leeching"
        ]
    },
    {
        id: "dungeons:obsidian_claymore",
        type: "obsidian_claymore",
        seasonal: false,
        damage: 9,
        durability: 1500,
        effects: [
            "area_damage"
        ]
    },
    {
        id: "dungeons:starless_night",
        type: "obsidian_claymore",
        seasonal: false,
        damage: 17,
        durability: 3500,
        effects: [
            "area_damage",
            "shared_pain"
        ]
    }
]

export const bowData = [
    {
        id: "dungeons:bow",
        type: "bow",
        seasonal: false,
        drawTime: 1,
        durability: 384,
        effects: []
    },
    {
        id: "dungeons:bonebow",
        type: "bow",
        seasonal: false,
        drawTime: 1,
        durability: 612,
        effects: [
            "growing"
        ]
    },
    {
        id: "dungeons:twin_bow",
        type: "bow",
        seasonal: false,
        drawTime: 1,
        durability: 612,
        effects: [
            "ricochet"
        ]
    },
    {
        id: "dungeons:longbow",
        type: "longbow",
        seasonal: false,
        drawTime: 1.5,
        durability: 421,
        effects: [
            "supercharge"
        ]
    },
    {
        id: "dungeons:guardian_bow",
        type: "longbow",
        seasonal: false,
        drawTime: 1.5,
        durability: 741,
        effects: [
            "supercharge_double"
        ]
    },
    {
        id: "dungeons:red_snake",
        type: "longbow",
        seasonal: false,
        drawTime: 1.5,
        durability: 741,
        effects: [
            "supercharge",
            "fuse_shot"
        ]
    },
    {
        id: "dungeons:snow_bow",
        type: "snow_bow",
        seasonal: false,
        drawTime: 1,
        durability: 361,
        effects: [
            "freezing"
        ]
    },
    {
        id: "dungeons:winters_touch",
        type: "snow_bow",
        seasonal: false,
        drawTime: 1,
        durability: 591,
        effects: [
            "freezing",
            "stunning_ranged"
        ]
    },
    {
        id: "dungeons:webbed_bow",
        type: "snow_bow",
        seasonal: true,
        drawTime: 1,
        durability: 591,
        effects: [
            "freezing",
            "stunning_ranged"
        ]
    },
    {
        id: "dungeons:soul_bow",
        type: "soul_bow",
        seasonal: false,
        drawTime: 0.75,
        durability: 198,
        effects: [
        ]
    },
    {
        id: "dungeons:nocturnal_bow",
        type: "soul_bow",
        seasonal: false,
        drawTime: 0.75,
        durability: 502,
        effects: [
            "tempo_theft"
        ]
    },
    {
        id: "dungeons:bow_of_lost_souls",
        type: "soul_bow",
        seasonal: false,
        drawTime: 0.75,
        durability: 502,
        effects: [
            "ricochet"
        ]
    },
    {
        id: "dungeons:wind_bow",
        type: "wind_bow",
        seasonal: false,
        drawTime: 1,
        durability: 399,
        effects: [
            "wind_arrows"
        ]
    },
    {
        id: "dungeons:echo_of_the_valley",
        type: "wind_bow",
        seasonal: false,
        drawTime: 1,
        durability: 698,
        effects: [
            "wind_arrows",
            "ricochet"
        ]
    },
    {
        id: "dungeons:burst_gale_bow",
        type: "wind_bow",
        seasonal: false,
        drawTime: 1,
        durability: 698,
        effects: [
            "wind_arrows",
            "sprint_charge"
        ]
    },
    {
        id: "dungeons:bubble_bow",
        type: "bubble_bow",
        seasonal: false,
        drawTime: 1,
        durability: 250,
        effects: [
            "bubble_arrows"
        ]
    },
    {
        id: "dungeons:bubble_burster",
        type: "bubble_bow",
        seasonal: false,
        drawTime: 1,
        durability: 590,
        effects: [
            "bubble_arrows",
            "reliable_ricochet"
        ]
    },
    {
        id: "dungeons:twisting_vine_bow",
        type: "twisting_vine_bow",
        seasonal: false,
        drawTime: 2,
        durability: 199,
        effects: [
            "poison_trail"
        ]
    },
    {
        id: "dungeons:weeping_vine_bow",
        type: "twisting_vine_bow",
        seasonal: false,
        drawTime: 2,
        durability: 461,
        effects: [
            "poison_trail",
            "sprint_charge"
        ]
    },
    {
        id: "dungeons:power_bow",
        type: "power_bow",
        seasonal: false,
        drawTime: 0.8,
        durability: 211,
        effects: [
            "supercharge"
        ]
    },
    {
        id: "dungeons:elite_power_bow",
        type: "power_bow",
        seasonal: false,
        drawTime: 0.8,
        durability: 451,
        effects: [
            "supercharge",
            "power"
        ]
    },
    {
        id: "dungeons:sabrewing",
        type: "power_bow",
        seasonal: false,
        drawTime: 0.8,
        durability: 451,
        effects: [
            "supercharge",
            "radiance_shot"
        ]
    },
    {
        id: "dungeons:void_bow",
        type: "void_bow",
        seasonal: false,
        drawTime: 1,
        durability: 333,
        effects: [
            "void_strike_ranged"
        ]
    },
    {
        id: "dungeons:call_of_the_void",
        type: "void_bow",
        seasonal: false,
        drawTime: 1,
        durability: 567,
        effects: [
            "void_strike_ranged",
            "fuse_shot"
        ]
    },
    {
        id: "dungeons:crossbow",
        type: "crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 464,
        effects: [
        ]
    },
    {
        id: "dungeons:burst_crossbow",
        type: "burst_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 465,
        effects: [
            "triple_shot"
        ]
    },
    {
        id: "dungeons:corrupted_crossbow",
        type: "burst_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 465,
        effects: [
            "triple_shot",
            "critical_hit"
        ]
    },
    {
        id: "dungeons:soul_hunter_crossbow",
        type: "burst_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 465,
        effects: [
            "triple_shot",
            "enigma_resonator"
        ]
    },
    {
        id: "dungeons:soul_crossbow",
        type: "soul_crossbow",
        seasonal: false,
        drawTime: 1,
        durability: 281,
        effects: [
        ]
    },
    {
        id: "dungeons:feral_soul_crossbow",
        type: "soul_crossbow",
        seasonal: false,
        drawTime: 1,
        durability: 461,
        effects: [
            "enigma_resonator"
        ]
    },
    {
        id: "dungeons:voidcaller",
        type: "soul_crossbow",
        seasonal: false,
        drawTime: 1,
        durability: 461,
        effects: [
            "gravity"
        ]
    },
    {
        id: "dungeons:heavy_crossbow",
        type: "heavy_crossbow",
        seasonal: false,
        drawTime: 1.5,
        durability: 696,
        effects: [
            "power"
        ]
    },
    {
        id: "dungeons:doom_crossbow",
        type: "heavy_crossbow",
        seasonal: false,
        drawTime: 1.5,
        durability: 936,
        effects: [
            "power",
            "punch"
        ]
    },
    {
        id: "dungeons:slayer_crossbow",
        type: "heavy_crossbow",
        seasonal: false,
        drawTime: 1.5,
        durability: 936,
        effects: [
            "power",
            "ricochet"
        ]
    },
    {
        id: "dungeons:exploding_crossbow",
        type: "exploding_crossbow",
        seasonal: false,
        drawTime: 2,
        durability: 486,
        effects: [
            "fuse_shot"
        ]
    },
    {
        id: "dungeons:firebolt_thrower",
        type: "exploding_crossbow",
        seasonal: false,
        drawTime: 2,
        durability: 812,
        effects: [
            "fuse_shot",
            "chain_reaction"
        ]
    },
    {
        id: "dungeons:imploding_crossbow",
        type: "exploding_crossbow",
        seasonal: false,
        drawTime: 2,
        durability: 812,
        effects: [
            "fuse_shot",
            "gravity"
        ]
    },
    {
        id: "dungeons:scatter_crossbow",
        type: "scatter_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 365,
        effects: [
            "multishot"
        ]
    },
    {
        id: "dungeons:harp_crossbow",
        type: "scatter_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 691,
        effects: [
            "double_multishot"
        ]
    },
    {
        id: "dungeons:lightning_harp_crossbow",
        type: "scatter_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 691,
        effects: [
            "multishot",
            "ricochet"
        ]
    },
    {
        id: "dungeons:dual_crossbows",
        type: "dual_crossbows",
        seasonal: false,
        drawTime: 1,
        durability: 466,
        effects: [
            "double_shot"
        ]
    },
    {
        id: "dungeons:baby_crossbows",
        type: "dual_crossbows",
        seasonal: false,
        drawTime: 1,
        durability: 766,
        effects: [
            "double_shot",
            "growing"
        ]
    },
    {
        id: "dungeons:spellbound_crossbows",
        type: "dual_crossbows",
        seasonal: false,
        drawTime: 1,
        durability: 766,
        effects: [
            "double_shot",
            "unchanting"
        ]
    },
    {
        id: "dungeons:cog_crossbow",
        type: "cog_crossbow",
        seasonal: false,
        drawTime: 2,
        durability: 500,
        effects: [
            "power_cog"
        ]
    },
    {
        id: "dungeons:pride_of_the_piglins",
        type: "cog_crossbow",
        seasonal: false,
        drawTime: 2,
        durability: 861,
        effects: [
            "power_cog",
            "quick_charge"
        ]
    },
    {
        id: "dungeons:harpoon_crossbow",
        type: "harpoon_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 321,
        effects: [
            "harpoon_arrows"
        ]
    },
    {
        id: "dungeons:nautical_crossbow",
        type: "harpoon_crossbow",
        seasonal: false,
        drawTime: 1.25,
        durability: 512,
        effects: [
            "harpoon_arrows",
            "harpoon_damage"
        ]
    },
    {
        id: "dungeons:shadow_crossbow",
        type: "shadow_crossbow",
        seasonal: false,
        drawTime: 1.3,
        durability: 444,
        effects: [
            "shadow_shot"
        ]
    },
    {
        id: "dungeons:veiled_crossbow",
        type: "shadow_crossbow",
        seasonal: false,
        drawTime: 1.3,
        durability: 888,
        effects: [
            "shadow_shot",
            "shadow_barb"
        ]
    },
    {
        id: "dungeons:shrieking_crossbow",
        type: "shadow_crossbow",
        seasonal: true,
        drawTime: 1.3,
        durability: 888,
        effects: [
            "shadow_shot",
            "shadow_barb"
        ]
    }
]

export const armourData = [
    {
        id: "dungeons:dark_armour",
        type: "dark_armour",
        seasonal: false,
        protection: 17,
        effects: [
            "dark_armour_protection"
        ]
    },
    {
        id: "dungeons:titans_shroud_armour",
        type: "dark_armour",
        seasonal: false,
        protection: 42,
        effects: [
            "dark_armour_protection",
            "titans_shroud_strength"
        ]
    },
    {
        id: "dungeons:plate_armour",
        type: "plate_armour",
        seasonal: false,
        protection: 20,
        effects: [
            "plate_armour_protection",
            "plate_slowdown"
        ]
    },
    {
        id: "dungeons:full_metal_armour",
        type: "plate_armour",
        seasonal: false,
        protection: 48,
        effects: [
            "plate_armour_protection",
            "full_metal_strength",
            "plate_slowdown"
        ]
    },
    {
        id: "dungeons:cauldron_armour",
        type: "plate_armour",
        seasonal: true,
        protection: 48,
        effects: [
            "plate_armour_protection",
            "full_metal_strength",
            "plate_slowdown"
        ]
    },
    {
        id: "dungeons:guard_armour",
        type: "guard_armour",
        seasonal: false,
        protection: 15,
        effects: [
            "guard_armour_cooldown",
            "guard_armour_artefact"
        ]
    },
    {
        id: "dungeons:ender_armour",
        type: "guard_armour",
        seasonal: false,
        protection: 38,
        effects: [
            "guard_armour_cooldown",
            "guard_armour_artefact",
            "ender_armour"
        ]
    },
    {
        id: "dungeons:snow_armour",
        type: "snow_armour",
        seasonal: false,
        protection: 16,
        effects: [
            "snow_armour_freeze_protection",
            "snow_armour_slow_reduction"
        ]
    },
    {
        id: "dungeons:frost_armour",
        type: "snow_armour",
        seasonal: false,
        protection: 40,
        effects: [
            "snow_armour_freeze_protection",
            "snow_armour_slow_reduction",
            "frost_armour"
        ]
    },
    {
        id: "dungeons:champions_armour",
        type: "champions_armour",
        seasonal: false,
        protection: 17,
        effects: [
            "melee_protection_champions"
        ]
    },
    {
        id: "dungeons:heros_armour",
        type: "champions_armour",
        seasonal: false,
        protection: 42,
        effects: [
            "melee_protection_champions",
            "healing_bonus"
        ]
    },
    {
        id: "dungeons:emerald_armour",
        type: "emerald_armour",
        seasonal: false,
        protection: 18,
        effects: [
            "prospector",
            "emerald_armour_cooldown"
        ]
    },
    {
        id: "dungeons:gilded_glory_armour",
        type: "emerald_armour",
        seasonal: false,
        protection: 44,
        effects: [
            "prospector",
            "emerald_armour_cooldown",
            "death_barter"
        ]
    },
    {
        id: "dungeons:opulent_armour",
        type: "emerald_armour",
        seasonal: false,
        protection: 44,
        effects: [
            "prospector",
            "emerald_armour_cooldown",
            "exp_shield"
        ]
    },
    {
        id: "dungeons:piglin_armour",
        type: "piglin_armour",
        seasonal: false,
        protection: 16,
        effects: [
            "piglin_armour_artefact_damage"
        ]
    },
    {
        id: "dungeons:golden_piglin_armour",
        type: "piglin_armour",
        seasonal: false,
        protection: 38,
        effects: [
            "piglin_armour_artefact_damage",
            "healing_reduces_cooldown"
        ]
    },
    {
        id: "dungeons:shulker_armour",
        type: "shulker_armour",
        seasonal: false,
        protection: 20,
        effects: [
            "shulker_armour_projectile_protection",
            "thrives_under_pressure"
        ]
    },
    {
        id: "dungeons:sturdy_shulker_armour",
        type: "shulker_armour",
        seasonal: false,
        protection: 48,
        effects: [
            "shulker_armour_projectile_protection",
            "thrives_under_pressure",
            "shulker_bullet"
        ]
    },
    {
        id: "dungeons:teleportation_armour",
        type: "teleportation_armour",
        seasonal: false,
        protection: 17,
        effects: [
            "teleportation_effect",
            "soul_gathering_chance"
        ]
    },
    {
        id: "dungeons:unstable_armour",
        type: "teleportation_armour",
        seasonal: false,
        protection: 40,
        effects: [
            "teleportation_effect",
            "soul_gathering_chance",
            "teleport_explosion"
        ]
    },
    {
        id: "dungeons:thief_armour",
        type: "thief_armour",
        seasonal: false,
        protection: 13,
        effects: [
            "thief_armour_cooldown"
        ]
    },
    {
        id: "dungeons:spider_armour",
        type: "thief_armour",
        seasonal: false,
        protection: 34,
        effects: [
            "thief_armour_cooldown",
            "spider_armour_lifesteal"
        ]
    },
    {
        id: "dungeons:grim_armour",
        type: "grim_armour",
        seasonal: false,
        protection: 16,
        effects: [
            "soul_gathering_chance",
            "grim_armour_lifesteal"
        ]
    },
    {
        id: "dungeons:wither_armour",
        type: "grim_armour",
        seasonal: false,
        protection: 40,
        effects: [
            "soul_gathering_chance",
            "grim_armour_lifesteal",
            "wither_armour_protection"
        ]
    },
    {
        id: "dungeons:spooky_gourdian_armour",
        type: "grim_armour",
        seasonal: true,
        protection: 36,
        effects: [
            "soul_gathering_chance",
            "grim_armour_lifesteal",
            "wither_armour_protection"
        ]
    },
    {
        id: "dungeons:ghostly_armour",
        type: "ghostly_armour",
        seasonal: false,
        protection: 11,
        effects: [
            "ghostly_armour"
        ]
    },
    {
        id: "dungeons:ghost_kindler_armour",
        type: "ghostly_armour",
        seasonal: false,
        protection: 30,
        effects: [
            "ghostly_armour",
            "fire_sprint"
        ]
    },
    {
        id: "dungeons:cloaked_skull_armour",
        type: "ghostly_armour",
        seasonal: true,
        protection: 30,
        effects: [
            "ghostly_armour",
            "fire_sprint"
        ]
    },
    {
        id: "dungeons:root_rot_armour",
        type: "root_rot_armour",
        seasonal: false,
        protection: 15,
        effects: [
            "healing_reduces_cooldown"
        ]
    },
    {
        id: "dungeons:black_spot_armour",
        type: "root_rot_armour",
        seasonal: false,
        protection: 38,
        effects: [
            "healing_reduces_cooldown",
            "healing_restores_hunger"
        ]
    },
    {
        id: "dungeons:sprout_armour",
        type: "sprout_armour",
        seasonal: false,
        protection: 12,
        effects: [
            "poison_sprint"
        ]
    },
    {
        id: "dungeons:living_vines_armour",
        type: "sprout_armour",
        seasonal: false,
        protection: 32,
        effects: [
            "poison_sprint",
            "poison_heal"
        ]
    },
    {
        id: "dungeons:evocation_armour",
        type: "evocation_armour",
        seasonal: false,
        protection: 13,
        effects: [
            "evocation_cooldown"
        ]
    },
    {
        id: "dungeons:ember_armour",
        type: "evocation_armour",
        seasonal: false,
        protection: 34,
        effects: [
            "evocation_cooldown",
            "ember_thorns"
        ]
    },
    {
        id: "dungeons:verdant_armour",
        type: "evocation_armour",
        seasonal: false,
        protection: 34,
        effects: [
            "evocation_cooldown",
            "bag_of_souls"
        ]
    },
    {
        id: "dungeons:soul_armour",
        type: "soul_armour",
        seasonal: false,
        protection: 13,
        effects: [
            "soul_robe_soulgather",
            "soul_robe_artefact"
        ]
    },
    {
        id: "dungeons:souldancer_armour",
        type: "soul_armour",
        seasonal: false,
        protection: 34,
        effects: [
            "soul_robe_soulgather",
            "soul_robe_artefact",
            "fox_armour_invulnerable"
        ]
    },
    {
        id: "dungeons:entertainers_armour",
        type: "entertainers_armour",
        seasonal: false,
        protection: 13,
        effects: [
            "positive_effect_increase"
        ]
    },
    {
        id: "dungeons:troubadour_armour",
        type: "entertainers_armour",
        seasonal: false,
        protection: 34,
        effects: [
            "positive_effect_increase",
            "negative_effect_decrease"
        ]
    },
    {
        id: "dungeons:wolf_armour",
        type: "wolf_armour",
        seasonal: false,
        protection: 12,
        effects: [
            "wolf_armour_melee_damage"
        ]
    },
    {
        id: "dungeons:black_wolf_armour",
        type: "wolf_armour",
        seasonal: false,
        protection: 32,
        effects: [
            "wolf_armour_melee_damage",
            "black_wolf_cooldown"
        ]
    },
    {
        id: "dungeons:fox_armour",
        type: "wolf_armour",
        seasonal: false,
        protection: 32,
        effects: [
            "wolf_armour_melee_damage",
            "fox_armour_invulnerable"
        ]
    },
    {
        id: "dungeons:ocelot_armour",
        type: "ocelot_armour",
        seasonal: false,
        protection: 14,
        effects: [
            "ocelot_armour_sprint"
        ]
    },
    {
        id: "dungeons:shadow_walker_armour",
        type: "ocelot_armour",
        seasonal: false,
        protection: 38,
        effects: [
            "ocelot_armour_sprint",
            "shadow_walker_sprint"
        ]
    },
    {
        id: "dungeons:beenest_armour",
        type: "beenest_armour",
        seasonal: false,
        protection: 15,
        effects: [
            "beenest_armour"
        ]
    },
    {
        id: "dungeons:beehive_armour",
        type: "beenest_armour",
        seasonal: false,
        protection: 38,
        effects: [
            "beenest_armour",
            "beehive_armour_protection"
        ]
    },
    {
        id: "dungeons:turtle_armour",
        type: "turtle_armour",
        seasonal: false,
        protection: 16,
        effects: [
            "healing_bonus"
        ]
    },
    {
        id: "dungeons:nimble_turtle_armour",
        type: "turtle_armour",
        seasonal: false,
        protection: 40,
        effects: [
            "healing_bonus",
            "rush"
        ]
    },
    {
        id: "dungeons:squid_armour",
        type: "squid_armour",
        seasonal: false,
        protection: 13,
        effects: [
            "squid_armour"
        ]
    },
    {
        id: "dungeons:glow_squid_armour",
        type: "squid_armour",
        seasonal: false,
        protection: 34,
        effects: [
            "squid_armour",
            "glow_squid_armour"
        ]
    },
    {
        id: "dungeons:phantom_armour",
        type: "phantom_armour",
        seasonal: false,
        protection: 17,
        effects: [
            "phantom_armour",
            "soul_gathering_chance"
        ]
    },
    {
        id: "dungeons:frost_bite_armour",
        type: "phantom_armour",
        seasonal: false,
        protection: 42,
        effects: [
            "phantom_armour",
            "soul_gathering_chance",
            "snowball"
        ]
    }

]

export const artefactData = [
    {
        id: "dungeons:satchel_of_elements",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 4
    },
    {
        id: "dungeons:ice_wand",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:lightning_rod",
        type: "artefact",
        seasonal: false,
        souls: 8,
        lines: 3
    },
    {
        id: "dungeons:harvester",
        type: "artefact",
        seasonal: false,
        souls: 15,
        lines: 3
    },
    {
        id: "dungeons:scatter_mines",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:blast_fungus",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:eye_of_the_guardian",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:corrupted_beacon",
        type: "artefact",
        seasonal: false,
        souls: "5/s",
        lines: 3
    },
    {
        id: "dungeons:corrupted_pumpkin",
        type: "artefact",
        seasonal: true,
        souls: "3.3/s",
        lines: 2
    },
    {
        id: "dungeons:updraft_tome",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:spinblade",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:soul_healer",
        type: "artefact",
        seasonal: false,
        souls: 10,
        lines: 3
    },
    {
        id: "dungeons:totem_of_regeneration",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:iron_hide_amulet",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:death_cap_mushroom",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:boots_of_swiftness",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:ghost_cloak",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 4
    },
    {
        id: "dungeons:light_feather",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:totem_of_shielding",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:totem_of_casting",
        type: "artefact",
        seasonal: false,
        souls: 12,
        lines: 3
    },
    {
        id: "dungeons:totem_of_soul_protection",
        type: "artefact",
        seasonal: false,
        souls: 5,
        lines: 3
    },
    {
        id: "dungeons:satchel_of_snacks",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 4
    },
    {
        id: "dungeons:satchel_of_elixirs",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 4
    },
    {
        id: "dungeons:powershaker",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:shadow_shifter",
        type: "artefact",
        seasonal: false,
        souls: 12,
        lines: 3
    },
    {
        id: "dungeons:shock_powder",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:gong_of_weakening",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:wind_horn",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 3
    },
    {
        id: "dungeons:corrupted_seeds",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:love_medallion",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:enchanters_tome",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:tasty_bone",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:wonderful_wheat",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:enchanted_grass",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:buzzy_nest",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:golem_kit",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:soul_lantern",
        type: "artefact",
        seasonal: false,
        souls: 13,
        lines: 2
    },
    {
        id: "dungeons:vexing_chant",
        type: "artefact",
        seasonal: false,
        souls: 0,
        lines: 2
    },
    {
        id: "dungeons:tome_of_duplication",
        type: "artefact",
        seasonal: false,
        souls: "Relative to effect",
        lines: 3
    }
]

/*
 
all the functions for formatting go here
 
this is just a space filler to make stuff easier to read
 
minecraft dungeons 2 was announced last week, so thats scary
 
idk why i said that
 
for fun, i guess?
 
im also preparing the jakynbocks reveal for my other addon rn
 
he will be revealled by the time you are reading this
 
if he isnt then i really fucked up lmao, oops
 
*/

function percentageColour(count, max, player) {
    var pct = count / max
    if (pct <= 0.25) return "§c"
    if (pct > 0.25 && pct <= 0.5) return "§v"
    if (pct > 0.5 && pct <= 0.75) return "§6"
    if (pct > 0.75 && pct < 1) return "§e"
    if (pct >= 1) return "§a"
}

function getHearts(value) {
    var returnString = ""
    for (let i = 0; i < value; i) {
        if (value - i >= 2) {
            returnString += ""
            i += 2
        } else if (value - i == 1) {
            i += 1
            returnString += ""
        }
    }
    return returnString;
}
function getArmourDisplay(value) {
    var returnString = ""
    if (value >= 32) return ` x${value / 2}`
    for (let i = 0; i < value; i) {
        if (value - i >= 2) {
            returnString += ""
            i += 2
        } else if (value - i == 1) {
            i += 1
            returnString += ""
        }
    }
    return returnString;
}

function makeTitle(typeId, text) {
    if (!text) {
        return {
            rawtext: [
                { translate: typeId.replace("dungeons:", "dungeons.boh.title.").replace("_armour", "") }
            ]
        }
    } else {
        return {
            rawtext: [
                { text: text },
                { translate: typeId.replace("dungeons:", "dungeons.boh.title.").replace("_armour", "") }
            ]
        }
    }
}
function makeBody(typeId) {
    return {
        rawtext: [
            { translate: typeId.replace("dungeons:", "dungeons.boh.body.").replace("_armour", "") }
        ]
    }
}
function getDamage(weapon) {
    if (!weapon) return "";
    const hearts = getHearts(weapon.damage)
    return {
        rawtext: [
            { translate: "dungeons.boh.damage" },
            { text: hearts }
        ]
    }
}

function getDrawTime(weapon) {
    if (!weapon) return "";
    var drawTime = weapon.drawTime
    if (drawTime == Math.floor(drawTime)) drawTime = `${drawTime}.0`
    return {
        rawtext: [
            { translate: "dungeons.boh.draw_time" },
            { text: drawTime + "s" }
        ]
    }
}
function getProtection(weapon) {
    if (!weapon) return "";
    const hearts = getArmourDisplay(weapon.protection)
    return {
        rawtext: [
            { translate: "dungeons.boh.protection" },
            { text: "\n" },
            { text: hearts }
        ]
    }
}
function getCooldown(time, rare) {
    if (!time) return "";
    if (time == Math.floor(time)) time = `${time}.0`
    if (rare) {
        return {
            rawtext: [
                { translate: "dungeons.boh.rare_cooldown" },
                { text: time + "s" }
            ]
        }
    } else {
        return {
            rawtext: [
                { translate: "dungeons.boh.cooldown" },
                { text: time + "s" }
            ]
        }
    }
}
function getSoulCost(weapon) {
    if (!weapon) return "";
    return {
        rawtext: [
            { translate: "dungeons.boh.consumes_souls" },
            { text: `${weapon.souls}` }
        ]
    }
}
function getDurability(weapon) {
    if (!weapon) return "";
    return {
        rawtext: [
            { translate: "dungeons.boh.durability" },
            { text: `${weapon.durability}` }
        ]
    }
}
function getDurabilityAverage(itemId) {
    itemId = itemId.replace("entertainers", "entertainer")
    const boots = new ItemStack(itemId.replace("armour", "boots"), 1)
    if (!boots) return console.warn(itemId.replace("armour", "boots") + " is not valid!")
    const chestplate = new ItemStack(itemId.replace("armour", "chestplate"), 1)
    if (!chestplate) return console.warn(itemId.replace("armour", "chestplate") + " is not valid!")
    const leggings = new ItemStack(itemId.replace("armour", "leggings"), 1)
    if (!leggings) return console.warn(itemId.replace("armour", "leggings") + " is not valid!")
    const helmet = new ItemStack(itemId.replace("armour", "helmet"), 1)
    if (!helmet) return console.warn(itemId.replace("armour", "helmet") + " is not valid!")
    const bDura = boots.getComponent("durability").maxDurability;
    const lDura = leggings.getComponent("durability").maxDurability;
    const cDura = chestplate.getComponent("durability").maxDurability;
    const hDura = helmet.getComponent("durability").maxDurability;
    return {
        rawtext: [
            { translate: "dungeons.boh.avg_durability" },
            { text: `${Math.round((bDura + lDura + cDura + hDura) / 4)}` }
        ]
    }
}
function makeEffect(effect, isLast) {
    if (isLast == true) {
        return {
            rawtext: [
                { translate: "dungeons.boh.effect." + effect },
                { text: `\n` }
            ]
        }
    } else {
        return {
            rawtext: [
                { translate: "dungeons.boh.effect." + effect },
                { text: `\n\n` }
            ]
        }
    }
}