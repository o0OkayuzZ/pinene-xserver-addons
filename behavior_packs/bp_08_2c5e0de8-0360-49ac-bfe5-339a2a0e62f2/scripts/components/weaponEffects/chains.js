import {
    world,
    system,
    EntityDamageCause,
    MolangVariableMap
} from "@minecraft/server";
import { specialDamage, isValidTarget } from "main.js";

const effectId = "dungeons:chains"

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
        if (Math.random() > 0.3) return;
        const loc = hurt.location;
        const dim = hurt.dimension;
        var chainedTargets = [hurt]
        if (chainedTargets.length == 1) {
            let target = findNewChainTarget(chainedTargets, attacker, chainedTargets[0].location, dim)
            if (target) chainedTargets.push(target)
        }
        if (chainedTargets.length == 2) {
            let target = findNewChainTarget(chainedTargets, attacker, chainedTargets[1].location, dim)
            if (target) chainedTargets.push(target)
        }
        if (chainedTargets.length == 3) {
            let target = findNewChainTarget(chainedTargets, attacker, chainedTargets[2].location, dim)
            if (target) chainedTargets.push(target)
        }
        var length = 5 + chainedTargets.length * 10
        for (const target of chainedTargets) {
            var l = target.location
            const map = new MolangVariableMap()
            map.setFloat("variable.duration", length / 20)
            dim.spawnParticle('dungeons:chain_point', { x: l.x, y: l.y + 0.1, z: l.z }, map)
        }
        dim.playSound('block.bell.hit', loc, { volume: 1, pitch: 2.5 });
        for (let i = 0; i < chainedTargets.length; i++) {
            system.runTimeout(() => {
                dim.playSound('block.bell.hit', loc, { volume: 2 - (i / 5), pitch: 2.5 + (i / 4) });

            }, i * 2)

        }
        for (let i = 0; i < length; i++) {
            system.runTimeout(() => {
                if (i % 15 == 0) {
                    if (chainedTargets.length > 1) {
                        for (const target of chainedTargets) {
                            if (!target.isValid) {
                                chainedTargets.pop(target)
                                continue;
                            }
                            if (target.dimension !== dim) {
                                chainedTargets.pop(target)
                                continue;
                            }
                            if (target == chainedTargets[0]) continue;
                            connectChains(target.location, loc, dim)
                        }
                    }
                }
                for (const target of chainedTargets) {
                    if (!target.isValid) {
                        chainedTargets.pop(target)
                        continue;
                    }
                    if (target.dimension !== dim) {

                        chainedTargets.pop(target)
                        continue;
                    }
                    target.tryTeleport(target.location)
                }
            }, i)
        }
    })
});

function connectChains(targetLoc, originLoc, dim) {
    const xDif = targetLoc.x - originLoc.x
    const yDif = targetLoc.y - originLoc.y
    const zDif = targetLoc.z - originLoc.z
    const distanceBetween = Math.hypot(originLoc.x - targetLoc.x, originLoc.y - targetLoc.y, originLoc.z - targetLoc.z)
    for (let i = 1; i < distanceBetween; i += 0.1) {
        dim.spawnParticle("dungeons:chain_connection", { x: originLoc.x + (xDif * (i / distanceBetween)), y: 1 + originLoc.y + (yDif * (i / distanceBetween)), z: originLoc.z + (zDif * (i / distanceBetween)) })

    }
}

function findNewChainTarget(chainedTargets, owner, loc, dim) {
    const chainRange = dim.getEntities({
        location: loc,
        minDistance: 0.5,
        maxDistance: 7,
        excludeFamilies: ['ignore']
    });
    for (const target of chainRange) {
        if (chainedTargets.includes(target)) continue
        if (isValidTarget(target) == false) continue;
        if (target === owner) continue;
        return target
    }
    return undefined
}