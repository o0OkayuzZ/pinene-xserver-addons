import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:artefact_synergy"

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (attacker.typeId !== 'minecraft:player') return;
    const cause = e.damageSource.cause;
    if (cause !== EntityDamageCause.entityAttack) return;
    const equippable = attacker.getComponent("equippable")
    if (!equippable) return;
    const heldItem = equippable.getEquipment("Mainhand")
    if (!heldItem) return;
    if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
    //effect code
    if (e.damage <= 0) return;;
    if (!attacker.hasTag(effectId)) return;
    e.damage = e.damage * 1.3
    system.run(() => {
        attacker.removeTag(effectId)
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
        if (!heldItem.hasTag(effectId) && !heldItem.getDynamicProperty(effectId.replace("dungeons:", "dungeons:gild_"))) return;
        if (!player.hasTag(effectId)) return;
        player.dimension.spawnParticle("dungeons:artefact_synergy_active", player.location)

    }
}, 5)