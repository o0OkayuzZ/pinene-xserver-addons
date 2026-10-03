import { world, system } from "@minecraft/server";

const OLD_entriesArray = [
    "ambush",
    "anima_conduit",
    "artefact_synergy",
    "busy_bee",
    "chains",
    "committed",
    "critical_hit",
    "echo",
    "enigma_resonator",
    "exploding",
    "freezing",
    "guarding_strike",
    "gravity",
    "illagers_bane",
    "leeching",
    "looting",
    "pain_cycle",
    "poison_cloud",
    "prospector",
    "radiance",
    "rampaging",
    "refreshment",
    "sharpened",
    "shockwave",
    "smiting",
    "soul_siphon",
    "stunning",
    "swirling",
    "thundering",
    "unchanting",
    "void_strike",
    "weakening",
    //ranged

    //armour
    "bag_o_souls",
    "beast_boss",
    "beast_surge",
    "burning",
    "chilling",
    "cool_down",
    "cowardice",
    "explorer",
    "final_shout",
    "fire_focus",
    "fire_trail",
    "food_reserves",
    "frenzied",
    "gravity_pulse",
    "health_synergy",
    "lightning_focus",
    "luck_of_the_sea",
    "lucky_explorer",
    "poison_focus",
    "potion_barrier",
    //prospector
    "protection",
    "reckless",
    "rush",
    "shadow_blast",
    "shadow_surge",
    "snowball",
    "soul_focus",
    "soul_speed",
    "speed_synergy",
    "thorns",

    //bows

    //anima_conduit
    "artefact_charge",
    "chain_reaction",
    //committed
    //critical_hit
    "cooldown_shot",
    //enigma_resonator
    "fuse_shot",
    //gravity
    "growing",
    "multishot",
    //poison_cloud
    "power",
    //"radiance"
    "ricochet",
    "shockweb",
    //smiting
    //"soul_siphon"
    "supercharge",
    "tempo_theft",
    //unchanting
    //"void_strike"
]

const entriesArray = []

import { meleeGilds, armourGilds, rangedGilds, canHave } from "misc/gilds.js"

for (const gild of meleeGilds) if (!entriesArray.includes(gild)) entriesArray.push(gild)
for (const gild of rangedGilds) if (!entriesArray.includes(gild)) entriesArray.push(gild)
for (const gild of armourGilds) if (!entriesArray.includes(gild)) entriesArray.push(gild)

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const PlayerSelector = { name: "victim", type: "PlayerSelector" };
    const Entries = { name: "dungeons:gild", type: "Enum" };
    registry.registerEnum("dungeons:gild", entriesArray)
    const gilditem = {
        name: "dungeons:gilditem",
        description: "Gild a players held-item.",
        cheatsRequired: true,
        permissionLevel: 1,
        mandatoryParameters: [PlayerSelector, Entries]
    }
    registry.registerCommand(gilditem,
        (source, victim, gild) => {
            const owner = source.sourceEntity
            system.run(() => {
                for (let player of victim) {
                    const equippable = player.getComponent("equippable")
                    if (!equippable) continue;
                    const held = equippable.getEquipment("Mainhand")
                    if (!held) {
                        owner.sendMessage(`${player.nameTag} has no held item!`)
                        continue;
                    }
                    if (held.maxAmount !== 1) {
                        owner.sendMessage(`${player.nameTag} has no valid held item!`)
                        continue;
                    }
                    const valids = canHave(held)
                    if (!valids) {
                        owner.sendMessage(`${player.nameTag}'s item cannot be gilded`)
                        continue;
                    }
                    if (valids == "melee" && !meleeGilds.includes(gild)) {
                        owner.sendMessage(`${player.nameTag}'s is not the proper type`)
                        continue;
                    }
                    if (valids == "ranged" && !rangedGilds.includes(gild)) {
                        owner.sendMessage(`${player.nameTag}'s is not the proper type`)
                        continue;
                    }
                    if (valids == "armor" && !armourGilds.includes(gild)) {
                        owner.sendMessage(`${player.nameTag}'s is not the proper type`)
                        continue;
                    }
                    if (held.getDynamicProperty("dungeons:gild_" + gild)) {
                        owner.sendMessage(`${player.nameTag}'s item is already gilded`)
                        continue;
                    }
                    if (held.hasTag("dungeons:" + gild)) {
                        owner.sendMessage(`${player.nameTag}'s item already has this effect`)
                        continue;
                    }
                    const lore = held.getLore()
                    var newLore = []
                    for (const entry of lore) {
                        if (entry.includes("§g§i§l§d")) continue;
                        newLore.push(entry)
                    }
                    newLore.push({ rawtext: [{ text: "§g§i§l§d" }, { text: "\n§r" }, { translate: "dungeons.desc.gild." + gild }] })
                    held.setLore(newLore)
                    for (const propertyId of held.getDynamicPropertyIds()) {
                        if (propertyId.includes("dungeons:gild")) held.setDynamicProperty(propertyId, null)
                    }
                    held.setDynamicProperty("dungeons:gild_" + gild, 1)
                    equippable.setEquipment("Mainhand", held)
                }
            })
        }
    );
});