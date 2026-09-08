import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { isValidTarget, gravityTo } from "main.js";

const effectId = "dungeons:gravity"

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
    if (hurt.hasTag("dungeons:area_hit")) return;
    if (e.damage <= 0) return;
    system.run(() => {
        var cd = world.scoreboard.getObjective('dungeons:gravity_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:gravity_t');
        }
        if (cd.hasParticipant(attacker.scoreboardIdentity)) {
            cd.setScore(attacker, 10);
            return;
        }
        system.run(() => {
            cd.setScore(attacker, 10);
            const dim = attacker.dimension
            const targetLoc = hurt.location;
            const gravityTargets = dim.getEntities({
                location: targetLoc,
                maxDistance: 4,
                minDistance: 0.5,
                excludeFamilies: ['ignore', 'gravity_immune']
            });
            if (gravityTargets.length <= 0) return;
            hurt.applyKnockback({ x: 0, z: 0 }, 0.1)
            dim.spawnParticle("dungeons:gravity", { x: targetLoc.x, y: targetLoc.y + 0.5, z: targetLoc.z })
            dim.playSound("mob.endermen.portal", targetLoc, { pitch: 0.65 })
            for (const target of gravityTargets) {
                if (target == attacker || target == hurt || isValidTarget(target) == false) continue;
                gravityTo(target, targetLoc)
            }
        })
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:gravity_t');
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