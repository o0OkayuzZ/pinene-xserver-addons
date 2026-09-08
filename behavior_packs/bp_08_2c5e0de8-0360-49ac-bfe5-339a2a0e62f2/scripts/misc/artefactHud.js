import {
    world,
    system,
    ItemStack
} from "@minecraft/server";


system.runInterval(() => {
    for (const player of world.getAllPlayers()) {
        const equip = player.getComponent("equippable");
        if (!equip) continue;
        const held = equip.getEquipment("Mainhand")
        if (!held) continue;
        if (held.hasTag("dungeons:crossbow") && player.hasTag("dungeons:debug")) {
            if (held.getDynamicProperty("dungeons:loaded")) player.onScreenDisplay.setActionBar([{ text: "§l§e" }, { translate: held.localizationKey }, { text: ": §a装填済み" }])
            if (!held.getDynamicProperty("dungeons:loaded")) player.onScreenDisplay.setActionBar([{ text: "§l§e" }, { translate: held.localizationKey }, { text: ": §c未装填" }])

        }
        if (player.getDynamicProperty("dungeons:cooldown_timer") == true) {
            if (!held.getComponent("dungeons:artefact_cooldown")) continue;
            const cd = held.getComponent("cooldown")
            const remainingTime = player.getItemCooldown(cd.cooldownCategory)
            if (remainingTime > 1) {
                if (cd.cooldownCategory.includes("spinblade") && remainingTime > 6) {
                    player.onScreenDisplay.setActionBar(`§l§e--:--`)
                } else {
                    const seconds = Math.ceil(remainingTime / 20)
                    var minutes = Math.floor(seconds / 60)
                    if (minutes < 10) minutes = `0${minutes}`
                    var remainingSeconds = seconds % 60
                    if (remainingSeconds < 10) remainingSeconds = `0${remainingSeconds}`
                    player.onScreenDisplay.setActionBar(`§l§e${minutes}:${remainingSeconds}`)
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
                        player.onScreenDisplay.setActionBar([{ text: "§7" }, { translate: item.localizationKey }, { text: `\n§b${world.scoreboard.getObjective('soulGauge').getScore(player)}§s ソウル ` }])
                    } else {
                        player.onScreenDisplay.setActionBar([{ text: "§7" }, { translate: item.localizationKey }])
                    }
                }
            }
            if (held.hasTag("dungeons:soul_artefact") && remainingTime == 0) {
                player.onScreenDisplay.setActionBar(`§b${world.scoreboard.getObjective('soulGauge').getScore(player)}§s ソウル `)
            }
        }
        if (held.hasTag("dungeons:soul_artefact")) {
            player.onScreenDisplay.setActionBar(`§b${world.scoreboard.getObjective('soulGauge').getScore(player)}§s ソウル `)
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
                    player.onScreenDisplay.setActionBar([{ text: "§7" }, { translate: item.localizationKey }, { text: `\n§b${world.scoreboard.getObjective('soulGauge').getScore(player)}§s ソウル ` }])
                } else {
                    player.onScreenDisplay.setActionBar([{ text: "§7" }, { translate: item.localizationKey }])
                }
            }
        }
    }
})
