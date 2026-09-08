import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.afterEvents.entityDie.subscribe((event) => {
    const deadEntity = event.deadEntity;
    const damageSource = event.damageSource.damagingEntity;
    if (!damageSource) {
        return;
    }
    if (damageSource.typeId !== "minecraft:player") return;
    if (!isWearingSet(damageSource, "dungeons:emerald_armour")) return;
    if (!deadEntity.matches({ families: ["player"] }) && !deadEntity.matches({ families: ["monster"] })) return;

    deadEntity.dimension.spawnParticle('dungeons:emerald', deadEntity.location)
    damageSource.playSound('artefact.shadow_break',
        {
            pitch: 1.5,
            volume: 0.3
        });
    let hp = deadEntity.getComponent('minecraft:health')
    var expAdded = hp.defaultValue * 0.2
    for (let i = 0; i < Math.floor(hp.defaultValue * 0.8); i++) {
        if (Math.random() > 0.5) expAdded += 1
    }
    expAdded = Math.round(expAdded)
    const increments = Math.floor(1 + expAdded / 20)
    var delay = 0
    for (let i = 0; i < expAdded; i += increments) {
        system.runTimeout(() => {
            damageSource.addExperience(increments)
        }, delay)
        delay += 1
        if (i > expAdded * 0.6) delay += 1
        if (i > expAdded * 0.9) delay += 1
    }

});

world.afterEvents.playerSwingStart.subscribe((e) => {
    const heldItem = e.heldItemStack;
    if (!heldItem) return;
    const player = e.player
    if (isWearingSet(player, "dungeons:emerald_armour"))
        system.runTimeout(() => {
            var cd = heldItem.getComponent("cooldown")
            if (cd !== undefined) {
                const timeLeft = player.getItemCooldown(cd.cooldownCategory)
                if (timeLeft > cd.cooldownTicks - 2) {
                    player.startItemCooldown(cd.cooldownCategory, Math.ceil(cd.cooldownTicks * 0.85))
                } else {
                    system.runTimeout(() => {
                        var cd2 = heldItem.getComponent("cooldown")
                        if (cd2 !== undefined) {
                            const timeLeft2 = player.getItemCooldown(cd2.cooldownCategory)
                            if (timeLeft2 > cd2.cooldownTicks - 3) {
                                player.startItemCooldown(cd2.cooldownCategory, Math.ceil(cd2.cooldownTicks * 0.85))
                            }
                        }
                    }, 1)
                }
            }
        }, 0)
})