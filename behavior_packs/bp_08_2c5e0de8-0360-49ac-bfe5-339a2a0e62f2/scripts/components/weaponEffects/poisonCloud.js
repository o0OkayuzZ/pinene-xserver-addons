import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import { specialDamage, isValidTarget } from "main.js";

const effectId = "dungeons:poison_cloud"

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
    const critical = Math.floor(Math.random() * 3);
    if (critical == 1) {
        system.run(() => {
            var cd = world.scoreboard.getObjective('dungeons:poison_cloud_t');
            if (!cd) {
                cd = world.scoreboard.addObjective('dungeons:poison_cloud_t');
            }
            if (cd.hasParticipant(attacker.scoreboardIdentity)) {
                return;
            }
            const dim = hurt.dimension
            const hurtLoc = hurt.location;
            cd.setScore(attacker, 80)
            dim.playSound('weapon.enchant.poison', hurtLoc)
            createPoisonCloud(5 * 2, dim, hurtLoc, attacker)
        })
    }

});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:poison_cloud_t');
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

// cloud
function createPoisonCloud(timeLeft, dim, loc, owner) {
    if (timeLeft <= 0) return;
    if (timeLeft > 1) {
        dim.spawnParticle("dungeons:poison_cloud_smoke", loc)
        dim.spawnParticle("dungeons:poison_cloud_swirls", loc)
    }
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 4,
        excludeFamilies: ['ignore']
    });
    for (const target of damageRange) {
        if (isValidTarget(target) == false) continue;
        if (target === owner) continue;
        var damage = 3
        if (target.typeId !== "minecraft:player") damage += 1
        const damageDone = specialDamage(owner, target, damage, EntityDamageCause.magic, ["poison"])
        if (damageDone) {
            target.applyKnockback({ x: 0, z: 0 }, -0.1)
            if (damage <= 3) target.addEffect("poison", 11)
            if (damage > 3) target.addEffect("fatal_poison", 11)
        }
    }
    system.runTimeout(() => {
        createPoisonCloud(timeLeft - 1, dim, loc, owner)
    }, 10)
}