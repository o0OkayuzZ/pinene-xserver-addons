import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";
import {getDirection, makeVector } from "main.js"



function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 60)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    dim.playSound("random.break", targetLoc, { pitch: 0.7 })
    dim.spawnParticle("minecraft:critical_hit_emitter", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
}

world.afterEvents.entityHitEntity.subscribe((e) => {
    const attacker = e.damagingEntity;
    if(!attacker || !attacker.isValid || !attacker.matches({families:["mountaineer"]})) return;
    const hurt = e.hitEntity;
    if(!hurt || !hurt.isValid || hurt.typeId !== "minecraft:player") return;
    const isShieldReady = hurt.getItemCooldown("minecraft:shield")
    if (isShieldReady > 0) return;
    if (hurt.isSneaking == false) return;
    const equippable = hurt.getComponent("equippable")
     if (!equippable) return;
     const mainHand = equippable.getEquipment("Mainhand")
     if (mainHand !== undefined) {
        if (mainHand.typeId == "minecraft:shield") {
            const dir = getDirection(attacker.location, hurt.location);
            hurt.applyKnockback(makeVector(dir, 1), 0.3)
            disableShield(hurt)
            return;
        }
    }
    const offhand = equippable.getEquipment("Offhand")
    if (offhand !== undefined) {
        if (offhand.typeId == "minecraft:shield") {
            const dir = getDirection(attacker.location, hurt.location);
            hurt.applyKnockback(makeVector(dir, 1), 0.3)
            disableShield(hurt)
            return;
        }
    }
})