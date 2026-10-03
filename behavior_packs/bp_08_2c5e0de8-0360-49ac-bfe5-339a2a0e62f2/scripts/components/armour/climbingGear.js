import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

const mult = 0.5

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:climbing_armour")) return;
    if (e.damageSource.cause == EntityDamageCause.fall) e.damage = e.damage * 0.5
    const attacker = e.damageSource.damagingEntity
    if(!attacker || !attacker.isValid) return;
    const v = hurt.getVelocity()
    system.runTimeout(() =>{
        const newV = hurt.getVelocity()
        var dif = {
            x: newV.x - v.x,
            y: newV.y - v.y,
            z: newV.z - v.z
        }
        hurt.clearVelocity()
        hurt.applyImpulse({
            x: v.x + dif.x*mult,
            y: v.y + dif.y*mult,
            z: v.z + dif.z*mult
        })
    },1)
});