import { world, system, ItemStack } from "@minecraft/server";

//this is a system that makes players less likely to get duplicate halloween items
// maybe in the future it will apply to all items? who knows

const items = [
    "dungeons:sinister_sword",
    "dungeons:skull_scythe",
    "dungeons:bonehead_hammer",
    "dungeons:cackling_broom",
    "dungeons:spine_chill_spear",
    "dungeons:haunted_bow",
    "dungeons:webbed_bow",
    "dungeons:shrieking_crossbow",
    "dungeons:gloopy_bow",
    "dungeons:phantom_bow",
    "dungeons:spooky_gourdian_helmet",
    "dungeons:cauldron_helmet",
    "dungeons:cloaked_skull_helmet",
    "dungeons:hungry_horror_helmet",
    "dungeons:hungriest_horror_helmet",
    "dungeons:corrupted_pumpkin"
]

function chooseItem(player, alreadyHas, rolledArmour) {
    const options = []
    for(const possible of items) if(!alreadyHas.includes(possible)) options.push(possible)
    if(options.length == 0) return undefined
    var selection = options[Math.floor(Math.random()*options.length)]
    const tag = "boh_collected:" + selection.replace("helmet","armour")
    if(player.hasTag(tag)) {
        selection = options[Math.floor(Math.random()*options.length)]
    }
    for(let i = 0; i < 10; i++) {
        if(rolledArmour && selection.includes("helmet")) {
            selection = options[Math.floor(Math.random()*options.length)]
        }
    }
    if(selection == undefined) return undefined
    return selection
}

function includesArmour(itemsChosen) {
    for(const item of itemsChosen) if (item && item.includes("helmet")) return true;
    return false;
}

world.afterEvents.playerInteractWithEntity.subscribe((e) => {
    const entity = e.target;
    const player = e.player
    const dim = entity.dimension;
    const loc = {
        x:entity.location.x,
        y:entity.location.y+1.1,
        z:entity.location.z
    }
    if(!entity || !entity.isValid || entity.typeId !== "dungeons:diamond_chest" || !player || !player.isValid) return;
    const item = e.beforeItemStack;
    if(!item || item.typeId !== "dungeons:skeleton_key") return;
    system.runTimeout(() => {
        var itemsChosen = []
        itemsChosen.push(chooseItem(player, itemsChosen, includesArmour(itemsChosen)))
        itemsChosen.push(chooseItem(player, itemsChosen, includesArmour(itemsChosen)))
        if(Math.random() > 0.5) {
            itemsChosen.push(undefined)
        } else {
            itemsChosen.push(chooseItem(player, itemsChosen, includesArmour(itemsChosen)))
        }
        if(Math.random() > 0.5) {
            itemsChosen.push(undefined)
        } else {
            itemsChosen.push(chooseItem(player, itemsChosen, includesArmour(itemsChosen)))
        }
        for(const option of itemsChosen) {
            if(option == undefined) continue;
            const itemsToDrop = []
            if(option.includes("helmet")) {
                itemsToDrop.push(new ItemStack(option.replace("helmet","boots"), 1))
                itemsToDrop.push(new ItemStack(option.replace("helmet","leggings"), 1))
                itemsToDrop.push(new ItemStack(option.replace("helmet","chestplate"), 1))
                itemsToDrop.push(new ItemStack(option, 1))
            } else {
                itemsToDrop.push(new ItemStack(option, 1))
            }
            for(const drop of itemsToDrop) {
                const itemEntity = dim.spawnItem(drop, loc)
                itemEntity.applyImpulse({x:Math.random()/10 - 0.05, y:0.02, z:Math.random()/10 - 0.05})
            }
        }
    }, 30)
})