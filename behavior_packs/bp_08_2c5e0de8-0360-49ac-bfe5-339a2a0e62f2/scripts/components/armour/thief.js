import {
    world,
    system
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"

world.afterEvents.playerSwingStart.subscribe((e) => {
    const heldItem = e.heldItemStack;
    if (!heldItem) return;
    const player = e.player
    if (isWearingSet(player, "dungeons:thief_armour"))
        system.runTimeout(() => {
            var cd = heldItem.getComponent("cooldown")
            if (cd !== undefined) {
                const timeLeft = player.getItemCooldown(cd.cooldownCategory)
                if (timeLeft > cd.cooldownTicks - 2) {
                    player.startItemCooldown(cd.cooldownCategory, Math.ceil(cd.cooldownTicks * 3 / 4))
                } else {
                    system.runTimeout(() => {
                        var cd2 = heldItem.getComponent("cooldown")
                        if (cd2 !== undefined) {
                            const timeLeft2 = player.getItemCooldown(cd2.cooldownCategory)
                            if (timeLeft2 > cd2.cooldownTicks - 3) {
                                player.startItemCooldown(cd2.cooldownCategory, Math.ceil(cd2.cooldownTicks * 3 / 4))
                            }
                        }
                    }, 1)
                }
            }
        }, 0)
})