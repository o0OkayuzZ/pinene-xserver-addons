import { world, system, ItemStack } from "@minecraft/server";

import { colourList, effectsList, debuffsList } from "components/armour/mystery.js"

system.beforeEvents.startup.subscribe(event => {
    const registry = event.customCommandRegistry;
    const PlayerSelector = { name: "victim", type: "PlayerSelector" };
    const Colour = { name: "dungeons:colour", type: "Enum" };
    registry.registerEnum("dungeons:colour", colourList)
    const Effect1 = { name: "dungeons:effect", type: "Enum" };
    registry.registerEnum("dungeons:effect", effectsList)
    const Effect2 = { name: "dungeons:secondary_effect", type: "Enum" };
    registry.registerEnum("dungeons:secondary_effect", effectsList)
    const Effect3 = { name: "dungeons:tertiary_effect", type: "Enum" };
    registry.registerEnum("dungeons:tertiary_effect", debuffsList)
    const mysteryarmour = {
        name: "dungeons:mysteryarmour",
        description: "Generate a customised set of armour.",
        cheatsRequired: true,
        permissionLevel: 1,
        mandatoryParameters: [Colour, Effect1, Effect2],
        optionalParameters: [Effect3]
    }
    registry.registerCommand(mysteryarmour,
        (source, colour, effect1, effect2, effect3) => {
            const player = source.sourceEntity
            system.run(() => {
                if(!colour) {
                    return player.sendMessage("§cNo colour was specified")
                }
                if(!effect1 || !effect2) {
                    return player.sendMessage("§cNo effect was specified")
                }
                if(effect1 == effect2) {
                    return player.sendMessage("§cCannot duplicate effects")
                }
                var colourId = colour
                if(colour == "green") colourId = undefined
                var helmet = undefined
                var chestplate = undefined
                if(colourId) {
                    helmet = new ItemStack("dungeons:mystery_helmet_" + colourId)
                    chestplate = new ItemStack("dungeons:mystery_chestplate_" + colourId)
                } else {
                    helmet = new ItemStack("dungeons:mystery_helmet")
                    chestplate = new ItemStack("dungeons:mystery_chestplate")
                }
                const leggings = new ItemStack("dungeons:mystery_leggings")
                const boots = new ItemStack("dungeons:mystery_boots")
                const items = [
                    helmet,
                    chestplate,
                    leggings,
                    boots
                ]
                const chosenEffects = [effect1, effect2]
                if(effect3) chosenEffects.push(effect3)
                for(const item of items) {
                    if(!item) return;
                    const loreArray = []
                    loreArray.push({translate: "dungeons.mystery_colour." + colour})
                    loreArray.push({ translate: "dungeons.desc.armour.full_set" })
                    for(const effect of chosenEffects) {
                        loreArray.push({translate: "dungeons.mystery." + effect})
                    }
                    item.setLore(loreArray)
                    for(let i = 0; i < chosenEffects.length; i++) {
                        item.setDynamicProperty(`dungeons:mystery_effect_${i}`, chosenEffects[i])
                    }
                    player.dimension.spawnItem(item, player.location)
                }
            })
        }
    );
});
