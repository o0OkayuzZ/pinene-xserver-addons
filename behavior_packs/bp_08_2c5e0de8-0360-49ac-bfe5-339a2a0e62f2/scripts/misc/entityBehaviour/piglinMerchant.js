import {
    world,
    system
} from "@minecraft/server";

import { ActionFormData, uiManager } from "@minecraft/server-ui"


import { meleeGilds, armourGilds, rangedGilds, canHave } from "misc/gilds.js"
const allGilds = []

for (const gild of meleeGilds) if (!allGilds.includes(gild)) allGilds.push(gild)
for (const gild of rangedGilds) if (!allGilds.includes(gild)) allGilds.push(gild)
for (const gild of armourGilds) if (!allGilds.includes(gild)) allGilds.push(gild)

const costs = [
    ["ambush", 10],
    ["anima_conduit", 14],
    ["artefact_charge", 13],
    ["artefact_synergy", 13],
    ["bag_o_souls", 17],
    ["beast_boss", 13],
    ["beast_surge", 15],
    ["burning", 17],
    ["busy_bee", 12],
    ["chain_reaction", 16],
    ["chains", 21],
    ["chilling", 18],
    ["committed", 22],
    ["cool_down", 34],
    ["cooldown_shot", 25],
    ["cowardice", 21],
    ["critical_hit", 23],
    ["critical_hit_ranged", 23],
    ["echo", 31],
    ["enigma_resonator", 31],
    ["enigma_resonator_ranged", 31],
    ["exploding", 29],
    ["explorer", 10],
    ["final_shout", 25],
    ["fire_focus", 25],
    ["fire_trail", 13],
    ["food_reserves", 10],
    ["freezing", 10],
    ["frenzied", 21],
    ["fuse_shot", 25],
    ["gravity", 26],
    ["gravity_ranged", 30],
    ["gravity_pulse", 15],
    ["growing", 10],
    ["guarding_strike", 31],
    ["health_synergy", 28],
    ["illagers_bane", 21],
    ["leeching", 35],
    ["lightning_focus", 25],
    ["looting", 33],
    ["luck_of_the_sea", 40],
    ["lucky_explorer", 22],
    ["pain_cycle", 29],
    ["poison_cloud", 39],
    ["poison_cloud_ranged", 39],
    ["poison_focus", 15],
    ["potion_barrier", 34],
    ["power", 27],
    ["prospector", 10],
    ["protection", 25],
    ["radiance", 36],
    ["radiance_ranged", 36],
    ["rampaging", 21],
    ["reckless", 41],
    ["refreshment", 21],
    ["ricochet", 19],
    ["rush", 25],
    ["shadow_blast", 31],
    ["shadow_surge", 25],
    ["sharpened", 30],
    ["shockwave", 25],
    ["shockweb", 19],
    ["smiting", 22],
    ["snowball", 20],
    ["soul_focus", 16],
    ["soul_siphon", 32],
    ["soul_speed", 10],
    ["speed_synergy", 6],
    ["stunning", 25],
    ["supercharge", 19],
    ["swirling", 31],
    ["tempo_theft", 30],
    ["thorns", 20],
    ["thundering", 26],
    ["unchanting", 26],
    ["unchanting_ranged", 20],
    ["void_strike", 47],
    ["void_strike_ranged", 37],
    ["weakening", 26]
]


function pickSales(entity) {
    const sales = []
    const meleeOptions = []
    const armourOptions = []
    const rangedOptions = []
    for (const gild of meleeGilds) meleeOptions.push(gild)
    for (const gild of rangedGilds) rangedOptions.push(gild)
    for (const gild of armourGilds) armourOptions.push(gild)
    sales.push(meleeOptions[Math.floor(Math.random() * meleeOptions.length)])
    sales.push(armourOptions[Math.floor(Math.random() * armourOptions.length)])
    sales.push(rangedOptions[Math.floor(Math.random() * rangedOptions.length)])
    for (let i = 0; i < 2; i++) {
        let leftovers = []
        for (const gild of allGilds) if (!sales.includes(gild)) leftovers.push(gild)
        sales.push(leftovers[Math.floor(Math.random() * leftovers.length)])

    }
    return sales
}

function getCost(entity, gild) {
    var costBase = 0
    const rerolls = entity.getDynamicProperty("dungeons:times_rerolled")
    costBase += rerolls
    if (costBase > 64) costBase = 64
    for (const entry of costs) {
        if (entry[0] == gild) costBase += entry[1]
    }
    if (gild == "reroll") costBase += 16
    return costBase
}

world.afterEvents.entitySpawn.subscribe((e) => {
    const entity = e.entity;
    if (entity.typeId !== "dungeons:piglin_merchant") return;
    const sales = pickSales(entity)
    entity.setDynamicProperty("dungeons:unlocked_trades", 0)
    entity.setDynamicProperty("dungeons:times_rerolled", 0)
    for (let i = 0; i < sales.length; i++) {
        let sale = sales[i]
        entity.setDynamicProperty(`dungeons:sale_${i}`, sale)
        entity.setDynamicProperty(`dungeons:cost_${i}`, Math.ceil(Math.random() * (getCost(entity, sale) * 0.4) + getCost(entity, sale)))
    }
})

function reroll(entity) {
    const sales = []
    for (let i = 0; i < 5; i++) {
        let leftovers = []
        for (const gild of allGilds) if (!sales.includes(gild)) leftovers.push(gild)
        sales.push(leftovers[Math.floor(Math.random() * leftovers.length)])

    }
    entity.setDynamicProperty("dungeons:times_rerolled", entity.getDynamicProperty("dungeons:times_rerolled") + 1 + Math.round(Math.random()))
    for (let i = 0; i < sales.length; i++) {
        let sale = sales[i]
        entity.setDynamicProperty(`dungeons:sale_${i}`, sale)
        entity.setDynamicProperty(`dungeons:cost_${i}`, Math.ceil(Math.random() * 5 + getCost(entity, sale)))
    }
}

function getGoldAmt(player) {
    var gold = 0
    const inventory = player.getComponent("inventory")
    const container = inventory.container;
    for (let i = 0; i < container.size; i++) {
        let itemSlot = container.getItem(i)
        if (!itemSlot) continue;
        if (itemSlot.typeId == "dungeons:ancient_gold_ingot") gold += itemSlot.amount
    }
    return gold
}

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
    const player = e.player
    const entity = e.target
    if (!entity || !entity.isValid || entity.typeId !== "dungeons:piglin_merchant") return;
    const item = e.itemStack;
    if (!item) {
        entity.playAnimation("animation.piglin_merchant.shake_head")
        entity.dimension.playSound("mob.piglin.angry", entity.location, { pitch: 0.6 })
        return;
    }
    var category = canHave(item)
    if (!category) {
        entity.playAnimation("animation.piglin_merchant.shake_head")
        entity.dimension.playSound("mob.piglin.angry", entity.location, { pitch: 0.6 })
        return;
    }
    var categoryArray = meleeGilds
    if (category == "armor") categoryArray = armourGilds
    if (category == "ranged") categoryArray = rangedGilds
    const saleOptions = []
    for (const propertyId of entity.getDynamicPropertyIds()) {
        if (propertyId.includes("dungeons:sale_")) {
            const cost = entity.getDynamicProperty(propertyId.replace("sale_", "cost_"))
            var costMult = 1
            if (category == "armor" && armourGilds.includes(entity.getDynamicProperty(propertyId))) costMult = 0.25
            saleOptions.push([entity.getDynamicProperty(propertyId), Math.ceil(cost * costMult)])
        }
    }
    const unlockedTrades = entity.getDynamicProperty("dungeons:unlocked_trades")
    let form = new ActionFormData();
    var title = { translate: entity.localizationKey }
    if (entity.nameTag) title = entity.nameTag
    form.title(title);
    form.body({ rawtext: [{ translate: "dungeons.piglin_merchant.description" }, { translate: item.localizationKey }] })
    if(category == "armor") form.label({ rawtext: [{text: "§7"},{translate: "dungeons.piglin_merchant.armor_warn"}]})
    form.label(` ${getGoldAmt(player)}`)
    const hiddenTradeCount = 2
    const buttonArray = []
    for (let i = 0; i < saleOptions.length; i++) {
        let sale = saleOptions[i]
        if (i >= saleOptions.length - (hiddenTradeCount - unlockedTrades)) {
            buttonArray.push([`locked`, 8])
            form.divider()
            form.button({ rawtext: [{ text: `§g8  §7` }, { translate: "dungeons.piglin_merchant.unlock" }] }, "textures/ui/form/gild/locked_slot")
        } else {
            buttonArray.push(sale)
            form.divider()
            if (categoryArray.includes(sale[0]) && (!item.hasTag("dungeons:" + sale[0]) && !item.getDynamicProperty("dungeons:gild_" + sale[0]))) {
                form.button({ rawtext: [{ text: `§g${sale[1]}  §6` }, { translate: "dungeons.gild." + sale[0] }] }, "textures/ui/form/gild/" + sale[0])

            } else {
                if (categoryArray.includes(sale[0])) {
                    form.button({ rawtext: [{ text: `§g${sale[1]}  §8` }, { translate: "dungeons.gild." + sale[0] }] }, "textures/ui/form/gild/" + sale[0])
                } else {
                    form.button({ rawtext: [{ text: `§g${sale[1]}  §7` }, { translate: "dungeons.gild." + sale[0] }] }, "textures/ui/form/gild/" + sale[0])
                }
            }
        }
    }
    const rerollCost = getCost(entity, "reroll")
    if (unlockedTrades == hiddenTradeCount) {
        buttonArray.push(["reroll", rerollCost])
        form.divider()
        form.button({ rawtext: [{ text: `§g${rerollCost}  §c` }, { translate: "dungeons.piglin_merchant.reroll" }] }, "textures/ui/form/gild/restock_slot")

    }
    const slownessApplier = system.runInterval(() => {
        if (!entity.isValid) {
            system.clearRun(slownessApplier)
            uiManager.closeAllForms(player)
        } else entity.addEffect("slowness", 2, { amplifier: 100, showParticles: false })
    })
    entity.teleport(entity.location, { facingLocation: player.location })
    form.show(player).then(r => {
        system.clearRun(slownessApplier)
        if (r.canceled) return;
        var goldAmt = getGoldAmt(player)
        const selection = buttonArray[r.selection][0]
        const cost = buttonArray[r.selection][1]
        var pay = false
        if (goldAmt >= cost) {
            pay = true
            //if (entity.isValid) entity.runCommand("replaceitem entity @s slot.weapon.mainhand 0 dungeons:ancient_gold_ingot")
        } else {
            entity.playAnimation("animation.piglin_merchant.shake_head")
            player.sendMessage({ translate: "dungeons.warn.cannot_afford" })
            return;
        }
        if (buttonArray[r.selection][0] == "reroll") {
            reroll(entity)
            entity.dimension.playSound("mob.piglin_merchant.reroll", entity.location, { pitch: 0.9 + Math.random() / 5 })
            if (pay) {
                player.runCommand(`clear @s dungeons:ancient_gold_ingot -1 ${cost}`)
                entity.dimension.playSound("mob.piglin_merchant.buy", entity.location, { pitch: 0.9 + Math.random() / 5 })
            }
        } else if (buttonArray[r.selection][0] == "locked") {
            if (unlockedTrades < hiddenTradeCount) entity.setDynamicProperty("dungeons:unlocked_trades", unlockedTrades + 1)
            if (pay) {
                player.runCommand(`clear @s dungeons:ancient_gold_ingot -1 ${cost}`)
                entity.dimension.playSound("mob.piglin_merchant.buy", entity.location, { pitch: 0.9 + Math.random() / 5 })
            }
        } else {
            const equippable = player.getComponent("equippable")
            if (equippable.getEquipment("Mainhand") && equippable.getEquipment("Mainhand").typeId == item.typeId && categoryArray.includes(selection) && (!item.hasTag("dungeons:" + selection) && !item.getDynamicProperty("dungeons:gild_" + selection))) {
                if (unlockedTrades < hiddenTradeCount) entity.setDynamicProperty("dungeons:unlocked_trades", unlockedTrades + 1)

                const lore = item.getLore()
                var newLore = []
                const gild = selection
                for (const entry of lore) {
                    if (entry.includes("§g§i§l§d")) continue;
                    newLore.push(entry)
                }
                newLore.push({ rawtext: [{ text: "§g§i§l§d" }, { text: "\n§r" }, { translate: "dungeons.desc.gild." + gild }] })
                item.setLore(newLore)
                for (const propertyId of item.getDynamicPropertyIds()) {
                    if (propertyId.includes("dungeons:gild")) item.setDynamicProperty(propertyId, null)
                }
                item.setDynamicProperty("dungeons:gild_" + gild, 1)
                equippable.setEquipment("Mainhand", item)
                entity.dimension.playSound("random.anvil_use", entity.location, { pitch: 1.3 + Math.random() / 5 })
                const rerolls = entity.getDynamicProperty("dungeons:times_rerolled")
                entity.setDynamicProperty("dungeons:times_rerolled", Math.floor(rerolls * 0.5))
                if (entity.getDynamicProperty("dungeons:times_rerolled") < 0) entity.setDynamicProperty("dungeons:times_rerolled", 0)
            } else {
                entity.playAnimation("animation.piglin_merchant.shake_head")
                player.sendMessage({ translate: "dungeons.warn.cannot_apply" })
                pay = false
            }
            if (pay) {
                player.runCommand(`clear @s dungeons:ancient_gold_ingot -1 ${cost}`)
                entity.dimension.playSound("mob.piglin_merchant.buy", entity.location, { pitch: 0.9 + Math.random() / 5 })
            }
        }
    }).catch(e => {
        console.error(e, e.stack);
    });
})