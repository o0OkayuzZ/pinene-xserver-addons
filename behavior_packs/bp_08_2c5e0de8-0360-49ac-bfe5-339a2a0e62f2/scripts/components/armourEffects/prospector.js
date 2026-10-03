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
    if (!isWearingSet(damageSource, "dungeons:prospector")) return;
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