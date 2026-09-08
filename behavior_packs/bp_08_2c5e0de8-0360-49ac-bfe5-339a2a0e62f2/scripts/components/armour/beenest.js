import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:beenest_armour")) return;
    if (Math.random() > 0.25) return;
    var dim = hurt.dimension
    const hurtLoc = hurt.getHeadLocation();
    const pet = dim.spawnEntity('dungeons:pet_bee', hurtLoc);
    let beeTameable = pet.getComponent('minecraft:tameable')
    beeTameable.tame(hurt);
    dim.spawnParticle("dungeons:busy_bee_spawn", hurtLoc)
    dim.playSound("artefact.buzzy_nest.spawn", hurtLoc)
});