import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { arrowTypes } from "components/ranged.js"

const effectId = "dungeons:artefact_charge_bow_effect"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (!projectile.isValid) return;
    if (!arrowTypes.includes(projectile.typeId)) return
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.projectile) return;
    if (!projectile.hasTag(effectId)) return;
    const canHit = projectile.getDynamicProperty("dungeons:can_hit");
    if (canHit <= 0) return;
    //effect code
    if (e.damage <= 0) return;
    if (!attacker.hasTag("dungeons:artefact_charge")) return;

    e.damage = e.damage * 1.5
    system.run(() => {
        attacker.removeTag("dungeons:artefact_charge")
        const dim = hurt.dimension
        const hurtLoc = hurt.location
        dim.spawnParticle("dungeons:artefact_synergy_hit", { x: hurtLoc.x, y: hurtLoc.y + 1, z: hurtLoc.z })
        dim.playSound("random.anvil_land", hurtLoc, { volume: 0.2, pitch: 1.5 })
    })

});


system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        const equippable = player.getComponent("equippable")
        if (!equippable) return;
        const heldItem = equippable.getEquipment("Mainhand")
        if (!heldItem) return;
        if (!heldItem.hasTag(effectId.replace("_bow_effect", "")) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_").replace("_bow_effect", ""))) return;
        if (!player.hasTag("dungeons:artefact_charge")) return;
        player.dimension.spawnParticle("dungeons:artefact_synergy_active", player.location)

    }
}, 5)