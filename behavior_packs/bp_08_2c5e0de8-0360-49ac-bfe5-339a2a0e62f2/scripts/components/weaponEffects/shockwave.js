import {
    world,
    system,
    EntityDamageCause,
    MolangVariableMap
} from "@minecraft/server";
import { specialDamage, isValidTarget, getDirection, makeVector } from "main.js";

function getDistance(target, entity) {
    const tloc = target.location
    const eloc = entity.location
    return Math.hypot(eloc.x - tloc.x, eloc.y - tloc.y, eloc.z - tloc.z)
}

const effectId = "dungeons:shockwave"

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
        var shockwaveCD = world.scoreboard.getObjective('dungeons:shockwave_t');
        if (!shockwaveCD) {
            shockwaveCD = world.scoreboard.addObjective('dungeons:shockwave_t');
        }
        if (shockwaveCD.hasParticipant(attacker.scoreboardIdentity)) {
            return;
        }
        system.run(() => {
            const vd = attacker.getViewDirection()
            shockwaveCD.setScore(attacker, 100);
            const dim = attacker.dimension
            const targets = []
            for (let i = 2; i < 5; i++) {
                var loc = attacker.location;
                loc = { x: loc.x + (vd.x * 6), y: loc.y + (vd.y * 6), z: loc.z + (vd.z * 6) }
                const damageRange = dim.getEntities({
                    location: loc,
                    maxDistance: 1 + i * 0.5,
                    excludeFamilies: ['ignore']
                });
                for (const target of damageRange) {
                    if (isValidTarget(target) == false) continue;
                    if (target === hurt) continue;
                    if (target === attacker) continue;
                    if (targets.includes(target)) continue;
                    targets.push(target)
                }
            }
            var loc = attacker.location;
            dim.playSound("weapon.enchant.swirling", loc, { pitch: 2 })
            const map = new MolangVariableMap()
            map.setFloat("variable.direction_x", vd.x)
            map.setFloat("variable.direction_y", vd.y)
            map.setFloat("variable.direction_z", vd.z)
            dim.spawnParticle('dungeons:shockwave_melee', { x: loc.x, y: loc.y + 1.2, z: loc.z }, map)
            dim.spawnParticle('dungeons:shockwave_melee_stars', { x: loc.x, y: loc.y + 1.2, z: loc.z }, map)
            for (const target of targets) {
                const distance = getDistance(target, attacker)
                system.runTimeout(() => {
                    if (target.isValid == true) {
                        var shockDamage = e.damage * 0.7
                        shockDamage = (shockDamage * ((10 - distance) / 5)) + (e.damage / 2)

                        const damageDone = specialDamage(attacker, target, shockDamage, EntityDamageCause.entityAttack, ["weapon"])
                        if (damageDone) {
                            const dir = getDirection(loc, target.location);
                            target.applyKnockback(makeVector(dir, 2 + ((10 - distance) / 5)), 0.35)
                        }
                    }
                }, 1 + Math.ceil(distance))
            }

        })
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:shockwave_t');
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