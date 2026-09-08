import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage, isValidTarget, getDirection, makeVector } from "main.js";

const effectId = "dungeons:swirling"

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
        var swirlingCD = world.scoreboard.getObjective('dungeons:swirling_t');
        if (!swirlingCD) {
            swirlingCD = world.scoreboard.addObjective('dungeons:swirling_t');
        }
        if (swirlingCD.hasParticipant(attacker.scoreboardIdentity)) {
            swirlingCD.setScore(attacker, 22);
            return;
        }
        system.run(() => {
            swirlingCD.setScore(attacker, 20);
            const dim = attacker.dimension
            const loc = attacker.location;
            dim.spawnParticle("dungeons:swirling", { x: loc.x, y: loc.y + 1, z: loc.z })
            dim.playSound("weapon.enchant.swirling", loc)
            const damageRange = dim.getEntities({
                location: loc,
                maxDistance: 4,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                if (isValidTarget(target) == false) continue;
                if (target === hurt) continue;
                if (target === attacker) continue;
                const damageDone = specialDamage(attacker, target, e.damage * 7 / 9, EntityDamageCause.entityAttack, ["weapon"])
                if (!damageDone) continue;
                const dir = getDirection(loc, target.location);
                target.applyKnockback(makeVector(dir, 1), 0.5)
            }
        })
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:swirling_t');
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