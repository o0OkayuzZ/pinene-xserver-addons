import {
    world
} from "@minecraft/server";

const id = "sharpness"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] }))
        e.damage = e.damage * 1.33
});