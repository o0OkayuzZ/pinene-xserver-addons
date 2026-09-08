import {
    world,
    system
} from "@minecraft/server";
import { weaponData, bowData, armourData, artefactData } from "components/other/theBookOfHeroes.js"

export function sendNotification(player, message, image, itemText, type, playSound) {
    if (!player.hasTag("dungeons:book_of_heroes_toasts")) return;
    if (player.hasTag("dungeons:toasts_off")) return;
    if (playSound === undefined || playSound) player.playSound("toast.book_of_heroes.in", { volume: 0.3, pitch: Math.random() * 0.2 + 0.9 });
    player.sendMessage({
        rawtext: [
            { text: `toast.${image}${image.length < 200 ? "$".repeat(200 - image.length) : ""}` },
            { translate: "dungeons.boh.new_recipe" },
            { text: "\n§r" },
            { translate: itemText },
            { text: `${message.length < 200 ? "$".repeat(200 - message.length) : ""}` }
        ]
    })
    if (playSound === undefined || playSound) {
        system.runTimeout(() => {
            if (player && player.isValid)
                player.playSound("toast.book_of_heroes.out", { volume: 0.3, pitch: Math.random() * 0.2 + 0.9 });
        }, 108);
    }
}

function formToast(itemId, player) {
    var imagePath = "textures/ui/form/" + getType(itemId) + "/" + itemId.replace("_armour", "").replace("dungeons:", "")
    var totalText = "dungeons.boh.new_recipe" + "\n§r" + itemId.replace("dungeons:", "dungeons.boh.title.").replace("_armour", "")
    sendNotification(player, totalText, imagePath, itemId.replace("dungeons:", "dungeons.boh.title.").replace("_armour", ""), "nomy", true)
}


function isInBook(itemId) {
    for (const item of weaponData) if (item.id == itemId) return itemId
    for (const item of bowData) if (item.id == itemId) return itemId
    for (const item of armourData) if (item.id == itemId.replace("_boots", "_armour").replace("_leggings", "_armour").replace("_chestplate", "_armour").replace("_helmet", "_armour")) return itemId.replace("_boots", "").replace("_leggings", "").replace("_chestplate", "").replace("_helmet", "") + "_armour"
    for (const item of artefactData) if (item.id == itemId.replace("rare_")) return itemId.replace("rare_")
    return false
}

function getCategory(bookId) {
    var lookup = undefined
    for (const item of weaponData) if (bookId == item.id) lookup = item
    for (const item of bowData) if (bookId == item.id) lookup = item
    for (const item of armourData) if (bookId == item.id) lookup = item
    for (const item of artefactData) if (bookId == item.id) lookup = item
    const type = lookup.type;
    const tag = "boh_collected:dungeons:" + type
    return tag
}
function getType(bookId) {
    for (const item of weaponData) if (bookId == item.id) return "melee"
    for (const item of bowData) if (bookId == item.id) return "ranged"
    for (const item of armourData) if (bookId == item.id) return "armour"
    for (const item of artefactData) if (bookId == item.id) return "artefact"
    return undefined
}
function fixId(id) {
    if (id == "dungeons:diamond_sword") return "dungeons:diamond_longsword"
    if (id == "dungeons:highlands_axe") return "dungeons:highland_axe"
    if (id == "dungeons:sword") return "dungeons:longsword"
    if (id == "dungeons:axe") return "dungeons:cleaving_axe"
    if (id == "dungeons:mace") return "dungeons:iron_mace"
    if (id == "dungeons:bone_club") return "dungeons:boneclub"
    if (id == "minecraft:bow") return "dungeons:bow"
    if (id == "minecraft:crossbow") return "dungeons:crossbow"
    if (id.includes("dungeons:entertainer_")) return id.replace("entertainer", "entertainers")
    if (id.includes("dungeons:rare_")) return id.replace("dungeons:rare_", "dungeons:")
    return id
}
world.afterEvents.playerInventoryItemChange.subscribe((e) => {
    const item = e.itemStack;
    const player = e.player;
    if (!item || !player) return;
    if (item.isStackable == true) return;
    if (item.typeId == "dungeons:book_of_heroes") return player.addTag("dungeons:book_of_heroes_toasts")
    var itemId = fixId(item.typeId)
    const bookId = isInBook(itemId)
    if (!bookId) return;
    const tag = "boh_collected:" + bookId
    const categoryTag = getCategory(bookId)
    if (!player.hasTag(tag)) {
        player.addTag(tag)
        formToast(bookId, player)
    }
    if (!player.hasTag(categoryTag)) {
        player.addTag(categoryTag)
    }
})

