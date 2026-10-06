import {
    world,
    system,
    ItemStack
} from "@minecraft/server";
import {getSoulBarText} from "misc/soulManager.js"


function getArrowIcon(type) {
    if(type == "firework") return "" + "§c"
    if(type == "flaming") return "" + "§v"
    if(type == "harpoon") return "" + "§w"
    if(type == "thundering") return "" + "§b"
    if(type == "torment") return "" + "§b"
    if(type == "void") return "" + "§a"
}

system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const equip = player.getComponent("equippable");
        if (!equip) continue;
        const held = equip.getEquipment("Mainhand")
        if (!held) continue;
        if (held.hasTag("dungeons:crossbow") || held.hasTag("dungeons:bow") || held.typeId == "minecraft:crossbow" || held.typeId == "minecraft:bow") {
            const arrowType = player.getDynamicProperty("dungeons:arrow_slot")
            if(!arrowType) continue;
            const prefix = getArrowIcon(arrowType)
            const number = player.getDynamicProperty("dungeons:arrow_count")
            player.onScreenDisplay.setActionBar(`§q§u§i§v§r${prefix} ${number} `)
            system.runTimeout(() => {
                const held2 = equip.getEquipment("Mainhand")
                if (held2 == undefined) {
                    player.onScreenDisplay.setActionBar(" ")
                    return
                } else if ((held2.hasTag("dungeons:crossbow") || held2.hasTag("dungeons:bow") || held2.typeId == "minecraft:crossbow" || held2.typeId == "minecraft:bow") == false) {
                    player.onScreenDisplay.setActionBar(" ");
                    return
                } else if((player.getDynamicProperty("dungeons:arrow_count") == undefined)) {
                    player.onScreenDisplay.setActionBar(" ");
                }
            },2)
        }
        if (player.getDynamicProperty("dungeons:cooldown_timer") == true) {
            if (!held.getComponent("dungeons:artefact_cooldown")) continue;
            const cd = held.getComponent("cooldown")
            const remainingTime = player.getItemCooldown(cd.cooldownCategory)
            if (remainingTime > 1) {
                if (cd.cooldownCategory.includes("spinblade") && remainingTime > 6) {
                    player.onScreenDisplay.setActionBar(`§c§o§o§l§r§l§e--:--`)
                } else if(held.hasTag("dungeons:quiver_artefact") && "minecraft:" + player.getDynamicProperty("dungeons:arrow_slot") == cd.cooldownCategory.replace("_rare","").replace("_quiver","")) {
                    if (held.hasTag("dungeons:soul_artefact")) {
                        var print = [{ text: `§l§e  --:--§r\n` }]
                        for(const element of getSoulBarText(player, false, true, true)) print.push(element)
                        player.onScreenDisplay.setActionBar({ rawtext: print })
                    } else {
                        player.onScreenDisplay.setActionBar(`§c§o§o§l§r§l§e--:--`)
                    }

                } else {
                    const seconds = Math.ceil(remainingTime / 20)
                    var minutes = Math.floor(seconds / 60)
                    if (minutes < 10) minutes = `0${minutes}`
                    var remainingSeconds = seconds % 60
                    if (remainingSeconds < 10) remainingSeconds = `0${remainingSeconds}`
                    if (held.hasTag("dungeons:soul_artefact")) {
                        var print = [{ text: `§l§e  ${minutes}:${remainingSeconds}§r\n` }]
                        for(const element of getSoulBarText(player, false, true, true)) print.push(element)
                        player.onScreenDisplay.setActionBar({ rawtext: print })
                    } else {
                        player.onScreenDisplay.setActionBar(`§c§o§o§l§r§l§e${minutes}:${remainingSeconds}`)
                    }
                }
                return;
            } else if (remainingTime == 1) {
                player.onScreenDisplay.setActionBar(" ")
                return;

            }
            if (held.hasTag("dungeons:tome_of_duplication") && remainingTime == 0) {
                var copying = undefined
                for (const tag of player.getTags()) {
                    if (tag.substring(0, 9) === 'tod:used_') {
                        copying = tag
                    }
                }
                if (copying) {
                    copying = copying.replace("tod:used_", "dungeons:")
                    const item = new ItemStack(copying, 1)
                    if (item.hasTag("dungeons:soul_artefact")) {
                        var print = [{ text: "§7" }, { translate: item.localizationKey },{ text: `\n` }]
                        for(const element of getSoulBarText(player, false, true, true)) print.push(element)
                        player.onScreenDisplay.setActionBar({ rawtext: print })
                    } else {
                        player.onScreenDisplay.setActionBar([{ text: "§7" }, { translate: item.localizationKey }])
                    }
                }
            }
            if (held.hasTag("dungeons:soul_artefact") && remainingTime == 0) {
                player.onScreenDisplay.setActionBar(getSoulBarText(player))
            }
        }
        if (held.hasTag("dungeons:soul_artefact")) {
            player.onScreenDisplay.setActionBar(getSoulBarText(player))
        }
        if (held.hasTag("dungeons:tome_of_duplication")) {
            var copying = undefined
            for (const tag of player.getTags()) {
                if (tag.substring(0, 9) === 'tod:used_') {
                    copying = tag
                }
            }
            if (copying) {
                copying = copying.replace("tod:used_", "dungeons:")
                const item = new ItemStack(copying, 1)
                if (item.hasTag("dungeons:soul_artefact")) {
                        var print = [{ text: "§7" }, { translate: item.localizationKey },{ text: `\n` }]
                        for(const element of getSoulBarText(player, false, true, true)) print.push(element)
                        player.onScreenDisplay.setActionBar({ rawtext: print })
                } else {
                    player.onScreenDisplay.setActionBar([{ text: "§7" }, { translate: item.localizationKey }])
                }
            }
        }
    }
}, 2)
