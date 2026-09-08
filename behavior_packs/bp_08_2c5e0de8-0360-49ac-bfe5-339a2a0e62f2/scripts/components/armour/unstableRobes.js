import {
    world,
    system,
    EntityDamageCause,
    ButtonState
} from "@minecraft/server";
import { isWearingSet } from "components/armour.js"
import { isValidTarget, specialDamage, getDirection, makeVector } from "main.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    const id = e.id;
    if (id === 'dungeons:teleport_roll') {

        const player = e.sourceEntity;
        if (isWearingSet(player, "dungeons:unstable_robes") == false) return;
        const message = e.message;
        const split = message.split("_")
        const dim = player.dimension;
        const loc = { x: parseFloat(split[0]), y: parseFloat(split[1]), z: parseFloat(split[2]) }
        system.runTimeout(() => {
            const damageRange = dim.getEntities({
                location: loc,
                maxDistance: 4,
                excludeFamilies: ['ignore']
            });
            for (const target of damageRange) {
                if (isValidTarget(target) == false) continue;
                if (target === player) continue;
                const damageDone = specialDamage(player, target, 12, EntityDamageCause.entityExplosion, ["explosion"])
                if (!damageDone) continue;
                const dir = getDirection(loc, target.location);
                target.applyKnockback(makeVector(dir, 0.65), 0.33)
            }
            dim.spawnParticle("dungeons:teleport_boom", { x: loc.x, y: loc.y - 0.5, z: loc.z })
            dim.spawnParticle("dungeons:teleport_boom_dust", loc)
            dim.playSound("random.explode", loc, { pitch: 0.7 })
            dim.playSound("armour.teleport.explode", loc)
        }, 5)
    }
});