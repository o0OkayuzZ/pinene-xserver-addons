import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet, isWearingMysteryArmour } from "components/armour.js"

const mult = 0.5

const doesntResist = [
    EntityDamageCause.drowning,
    EntityDamageCause.entityAttack,
    EntityDamageCause.entityExplosion,
    EntityDamageCause.fireworks,
    EntityDamageCause.flyIntoWall,
    EntityDamageCause.fall,
    EntityDamageCause.maceSmash,
    EntityDamageCause.none,
    EntityDamageCause.override,
    EntityDamageCause.ramAttack,
    EntityDamageCause.projectile,
    EntityDamageCause.selfDestruct,
    EntityDamageCause.sonicBoom,
    EntityDamageCause.starve,
    EntityDamageCause.suffocation,
    EntityDamageCause.thorns,
    EntityDamageCause.void,
    EntityDamageCause.wither
]

world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:rugged_climbing_armour") && !isWearingMysteryArmour(hurt, "environment_resist")) return;
    if(doesntResist.includes(e.damageSource.cause)) return;
    
    const attacker = e.damageSource.damagingEntity
    const projectile = e.damageSource.damagingProjectile
    if(attacker || projectile) return;
     e.damage = e.damage * mult
});