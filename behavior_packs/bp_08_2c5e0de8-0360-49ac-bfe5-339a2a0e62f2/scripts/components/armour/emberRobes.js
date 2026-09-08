import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"
import { isValidTarget, specialDamage } from "main.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!isWearingSet(hurt, "dungeons:ember_robes")) return;
    var cd = world.scoreboard.getObjective('dungeons:ember_robes_t');
    if (!cd) {
        cd = world.scoreboard.addObjective('dungeons:ember_robes_t');
    }
    if (cd.hasParticipant(hurt.scoreboardIdentity)) {
        return;
    }
    const dim = hurt.dimension
    const loc = hurt.location;
    cd.setScore(hurt, 50)
    dim.spawnParticle("dungeons:satchel_elements_use_fire", { x: loc.x, y: loc.y + 1, z: loc.z })
    dim.playSound("mob.ghast.fireball", loc)

    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 4,
        excludeFamilies: ['ignore']
    });
    if (damageRange.includes(attacker) == false && attacker.isValid) damageRange.push(attacker)
    for (const target of damageRange) {
        if (isValidTarget(target) == false) continue;
        if (target === hurt) continue;
        const setOnFire = target.setOnFire(3 + 2 * Math.random(), true)
        if (setOnFire) {
            specialDamage(hurt, target, 4, EntityDamageCause.fire, ["fire"])
            dim.spawnParticle("dungeons:satchel_elements_fire", target.location)
        }

    }

});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:ember_robes_t');
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