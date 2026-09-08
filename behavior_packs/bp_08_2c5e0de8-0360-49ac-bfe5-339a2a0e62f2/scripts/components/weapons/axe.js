import {
    world,
    system
} from "@minecraft/server";

function disableShield(hit) {
    hit.startItemCooldown("minecraft:shield", 120)
    const dim = hit.dimension;
    const targetLoc = hit.location;
    dim.playSound("random.break", targetLoc, { pitch: 0.6 })
    dim.spawnParticle("minecraft:critical_hit_emitter", { x: targetLoc.x, y: targetLoc.y + 0.4, z: targetLoc.z })
}

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:axe', {
        onHitEntity(e) {
            if (e.hadEffect == true) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
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
                    disableShield(hit)
                    return;
                }
            }
            const offhand = equippable.getEquipment("Offhand")
            if (offhand !== undefined) {
                if (offhand.typeId == "minecraft:shield") {
                    disableShield(hit)
                    return;
                }
            }
        }
    });
});
