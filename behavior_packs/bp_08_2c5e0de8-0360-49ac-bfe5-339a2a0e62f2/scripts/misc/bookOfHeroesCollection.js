import {
    world,
    system
} from "@minecraft/server";
import { weaponData, bowData, armourData, artefactData } from "components/other/theBookOfHeroes.js"
function pad(str, len) {
  if (str.length >= len) return str.slice(0, len);
  return str + "$".repeat(len - str.length);
}
export function sendNotification(player, message, image, itemText, type, playSound, background) {
    if (!player.hasTag("dungeons:book_of_heroes_toasts")) return;
    if (player.hasTag("dungeons:toasts_off")) return;
    if (playSound === undefined || playSound) player.playSound("toast.book_of_heroes.in", { volume: 0.3, pitch: Math.random() * 0.2 + 0.9 });
    
    const bg = background ? background : "textures/ui/toast/style_dungeons";

    player.sendMessage({
        rawtext: [
            { text: `toast.${pad(image, 150)}` },
            { text: pad(bg, 50) },
            { translate: "dungeons.boh.new_recipe" },
            { text: "\n§r" },
            { translate: itemText }
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
    const spooky = isSeasonal(itemId)
    var background = spooky ? "textures/ui/toast/style_dungeons_spooky" : undefined
    sendNotification(player, totalText, imagePath, itemId.replace("dungeons:", "dungeons.boh.title.").replace("_armour", ""), "nomy", true, background)
}


function isInBook(itemId) {
    try {
        for (const item of weaponData) if (item.id == itemId) return itemId
        for (const item of bowData) if (item.id == itemId) return itemId
        for (const item of armourData) if (item.id == itemId.replace("_boots", "_armour").replace("_leggings", "_armour").replace("_chestplate", "_armour").replace("_helmet", "_armour")) return itemId.replace("_boots", "").replace("_leggings", "").replace("_chestplate", "").replace("_helmet", "") + "_armour"
        for (const item of artefactData) if (item.id == itemId.replace("rare_")) return itemId.replace("rare_","")
        return false
    } catch { 
        return false
    }
}

function isSeasonal(bookId) {
    var lookup = undefined
    for (const item of weaponData) if (bookId == item.id) lookup = item
    for (const item of bowData) if (bookId == item.id) lookup = item
    for (const item of armourData) if (bookId == item.id) lookup = item
    for (const item of artefactData) if (bookId == item.id) lookup = item
    const type = lookup.seasonal;
    return type
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

const _pendingQueue = [];
let _jobRunning = false;

world.afterEvents.playerInventoryItemChange.subscribe((e) => {
    const item = e.itemStack;
    const player = e.player;
    if (!item || !player) return;
    _pendingQueue.push({ item, player });
    if (!_jobRunning) {
        _jobRunning = true;
        system.runJob(processQueueJob());
    }
});

function* processQueueJob() {
    while (_pendingQueue.length > 0) {
        const next = _pendingQueue.shift();
        if (next.player && next.player.isValid) {
            registerItem(next.item, next.player);
        }
        yield;
    }
    _jobRunning = false;
}

function registerItem(item, player) {
    if (!item || !player) return;
    if (item.isStackable == true) return;
    if (item.typeId == "dungeons:book_of_heroes") return player.addTag("dungeons:book_of_heroes_toasts")
    var itemId = fixId(item.typeId)
    if (item.typeId.includes("dungeons:mystery_")) itemId = itemId.replace("_pink", "").replace("_purple", "").replace("_black", "").replace("_orange", "").replace("_green", "").replace("_red", "").replace("_blue", "").replace("_light_blue", "").replace("_white", "")
    try {
        const bookId = isInBook(itemId)
        if (!bookId) return;
        const tag = "boh_collected:" + bookId
        const categoryTag = getCategory(bookId)
        if (!player.hasTag(tag)) {
            player.addTag(tag)
            formToast(bookId, player)
        }
        if (!categoryTag) return;
        if (!player.hasTag(categoryTag)) {
            player.addTag(categoryTag)
        }
    } catch {
        return;
    }
}
