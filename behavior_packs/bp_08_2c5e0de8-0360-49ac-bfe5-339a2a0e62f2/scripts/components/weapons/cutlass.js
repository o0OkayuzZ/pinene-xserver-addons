import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { getDirection, makeVector } from "main.js";

function disableShield(hit, attacker, item) {
    hit.startItemCooldown("minecraft:shield", 100)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    const dir = getDirection(attacker.location, targetLoc);
    hit.applyKnockback(makeVector(dir, 1.2), 0.23)
    dim.playSound("random.break", targetLoc, { pitch: 0.8 })
    dim.playSound("attack.sweep", targetLoc, { volume: 0.8, pitch: 1.1 })
    dim.spawnParticle(item.typeId, { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
    system.runTimeout(() => {

        hit.applyDamage(4, { cause: EntityDamageCause.entityAttack, damagingEntity: attacker })
    }, 1)
}

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:cutlass', {
        onHitEntity(e) {
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            if (e.itemStack.typeId == "dungeons:sparkler") {
                const dim = hit.dimension
                dim.spawnParticle("dungeons:sparkler_hit", {
                    x: hit.location.x,
                    y: hit.location.y + 1,
                    z: hit.location.z
                })
                dim.playSound("weapon.sparkler.hit", hit.location)
                if (Math.random() > 0.1) {
                    system.runTimeout(() => {
                        dim.playSound("weapon.sparkler.crakles", hit.location, { pitch: Math.random() / 5 + 0.9 })
                    }, 10)

                }
            }
            if (e.hadEffect == true) return;
            if (!attacker.isValid || !hit.isValid) return;
            if (hit.typeId !== "minecraft:player") return;
            const isShieldReady = hit.getItemCooldown("minecraft:shield")
            if (isShieldReady > 0) return;
            if (hit.isSneaking == false) return;
            const equippable = hit.getComponent("equippable")
            if (!equippable) return;
            const mainHand = equippable.getEquipment("Mainhand")
            if (mainHand !== undefined) {
                if (mainHand.typeId == "minecraft:shield") {
                    disableShield(hit, attacker, e.itemStack)
                    return;
                }
            }
            const offhand = equippable.getEquipment("Offhand")
            if (offhand !== undefined) {
                if (offhand.typeId == "minecraft:shield") {
                    disableShield(hit, attacker, e.itemStack)
                    return;
                }
            }
        }
    });
});
