import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import { usedArtefact } from "components/artefacts/artefactCooldown.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:final_shout")) return;
    const hp = hurt.getComponent("health")
    if (!hp) return;
    if (hp.currentValue > hp.effectiveMax / 4) return;
    var cd = world.scoreboard.getObjective('dungeons:final_shout_t');
    if (!cd) {
        cd = world.scoreboard.addObjective('dungeons:final_shout_t');
    }
    if (cd.hasParticipant(hurt.scoreboardIdentity)) {
        return;
    }
    const dim = hurt.dimension
    const loc = hurt.location;
    cd.setScore(hurt, 400)

    var sound = false
    const inventory = hurt.getComponent("inventory")
    if (!inventory) return;
    var artefacts = []
    const container = inventory.container;
    for (let i = 0; i < 9; i++) {
        const itemCheck = container.getItem(i)
        if (!itemCheck) continue;
        if (itemCheck.getComponent("dungeons:artefact_cooldown") == false) continue;
        const cooldown = itemCheck.getComponent("cooldown")
        if (!cooldown) continue;
        //if (artefacts.length > 3) continue;
        if (cooldown.getCooldownTicksRemaining(hurt) >= cooldown.cooldownTicks * 0.8) continue;
        var copy = false
        for (const artefact of artefacts) if (artefact.typeId == itemCheck.typeId.replace("rare_", "")) copy = true
        for (const artefact of artefacts) if (artefact.typeId == itemCheck.typeId.replace("rare_", "").replace("dungeons:", "dungeons:rare_")) copy = true
        if (!copy) artefacts.push(itemCheck)
    }
    for (let i = 0; i < artefacts.length; i++) {
        usedArtefact(hurt, artefacts[i], true)
        sound = true
    }

    if (sound) {
        dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x + 1.5, y: loc.y + 1, z: loc.z + 1.5 })
        dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x + 1.5, y: loc.y + 1, z: loc.z - 1.5 })
        dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x - 1.5, y: loc.y + 1, z: loc.z + 1.5 })
        dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x - 1.5, y: loc.y + 1, z: loc.z - 1.5 })
        dim.playSound("block.bell.hit", loc, { pitch: 1.5 })
    }


});