import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

const effectId = "dungeons:stunning"

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
    if (!heldItem.hasTag(effectId) && heldItem.getDynamicProperty("dungeons:gild") !== effectId) return;
    //effect code
    if (e.damage <= 0) return;
    system.run(() => {
        var stunDuration = world.scoreboard.getObjective('dungeons:stun_t');
        if (!stunDuration) {
            stunDuration = world.scoreboard.addObjective('dungeons:stun_t');
        }
        if (stunDuration.hasParticipant(attacker.scoreboardIdentity)) return;
        const stunChance = Math.floor(Math.random() * 4);
        if (stunChance == 1) {
            system.run(() => {
                stunDuration.setScore(attacker, 100);
                const dim = hurt.dimension
                const hurtLoc = hurt.location;
                dim.spawnParticle("dungeons:stun_1s", hurtLoc)
                dim.playSound("ambient.weather.lightning.impact", hurtLoc, { volume: 0.33, pitch: 2.5 })
                hurt.addEffect("slowness", 20, { amplifier: 9, showParticles: false })
                hurt.addEffect("weakness", 20, { amplifier: 9, showParticles: false })
                hurt.applyImpulse({ x: 0, y: -1, z: 0 })
            })
        }
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:stun_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) {
            timeLeft.addScore(player, -1);
        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
        }
    }
});