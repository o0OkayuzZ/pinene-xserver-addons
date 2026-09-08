import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, makeVector, getDirection } from "main.js"

function windBurst(range, dim, loc) {
    dim.spawnParticle("minecraft:wind_explosion_emitter", { x: loc.x, y: loc.y + 0.2, z: loc.z })
    dim.playSound("breeze_wind_charge.burst", loc)


    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: range,
        excludeFamilies: ['ignore', "monster"]
    });
    for (const target of damageRange) {
        if (target.isValid && (isValidTarget(target) || target.matches({ families: ["player"] }))) {
            if (target.matches({ families: ["monster"] })) continue;

            const dir = getDirection(loc, target.location);
            target.applyKnockback(makeVector(dir, 1.5), 0.5)
        }
    }
}

// WIND TOTEM
world.afterEvents.dataDrivenEntityTrigger.subscribe((event) => {
    const mob = event.entity;
    const eventId = event.eventId;
    if (eventId !== 'dungeons:totem_timer') {
        return;
    }
    const hp = mob.getComponent('minecraft:health');
    if (!hp) {
        return;
    }
    const dim = mob.dimension
    const loc = mob.location
    if (hp.currentValue < 100) {
        if (!(mob.hasTag('dungeons:wt_cd')) && Math.floor(Math.random() * 111) == 2) {
            windBurst(3, dim, loc)
            if (Math.floor(Math.random() * 8) == 2) {
                dim.spawnEntity('minecraft:pillager', {
                    x: loc.x,
                    y: loc.y,
                    z: loc.z - 1
                });
            }
            mob.addTag('dungeons:wt_cd');
            system.runTimeout(() => {
                mob.removeTag('dungeons:wt_cd')
            }, 100);
            return;
        }
    }
    const nearby = dim.getPlayers({
        location: loc,
        maxDistance: 4,
        excludeGameModes: ["Spectator"]
    });
    if (nearby.length == 0) return;
    dim.spawnParticle('dungeons:wind_totem_power', loc);
    hp.setCurrentValue(hp.currentValue - 1);
    const rand1 = Math.floor(Math.random() * 13) + 1;
    const rand2 = Math.floor(Math.random() * 100) + 1;
    const rand3 = Math.floor(Math.random() * 7) + 1;
    if ((!(mob.hasTag('dungeons:wt_cd')) && rand1 == 1 && (1.15 * hp.currentValue) < rand2) || hp.currentValue == 66 || hp.currentValue == 33) {
        windBurst(3, dim, loc)
        if (rand3 == 1) {
            dim.spawnEntity('minecraft:vindicator', {
                x: loc.x,
                y: loc.y,
                z: loc.z - 1
            });
            mob.addTag('dungeons:wt_cd');
            system.runTimeout(() => {
                if (mob.isValid) mob.removeTag('dungeons:wt_cd')
            }, 100);
        }
        if (rand3 == 2) {
            dim.spawnEntity('minecraft:pillager', {
                x: loc.x,
                y: loc.y,
                z: loc.z - 1
            });
            dim.spawnEntity('minecraft:pillager', {
                x: loc.x + 1,
                y: loc.y,
                z: loc.z
            });
            mob.addTag('dungeons:wt_cd');
            system.runTimeout(() => {
                if (mob.isValid) mob.removeTag('dungeons:wt_cd')
            }, 200);
        }
        if (rand3 == 3) {
            dim.spawnEntity('minecraft:pillager', {
                x: loc.x,
                y: loc.y,
                z: loc.z - 1
            });
            mob.addTag('dungeons:wt_cd');
            system.runTimeout(() => {
                if (mob.isValid) mob.removeTag('dungeons:wt_cd')
            }, 100);
        }
        if (rand3 == 4) {
            dim.spawnEntity('dungeons:windcaller', {
                x: loc.x,
                y: loc.y,
                z: loc.z - 1
            });
            mob.addTag('dungeons:wt_cd');
            system.runTimeout(() => {
                if (mob.isValid) mob.removeTag('dungeons:wt_cd')
            }, 100);
        }
    }
})