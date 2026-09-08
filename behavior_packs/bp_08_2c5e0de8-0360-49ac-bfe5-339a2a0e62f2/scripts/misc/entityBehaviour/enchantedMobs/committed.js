import {
    world
} from "@minecraft/server";

const id = "committed"

world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        if (e.damage <= 0) return;
        const hurt = e.hurtEntity;
        if (!hurt) return;
        if (!hurt.isValid) return;
        const baseDamage = e.damage;
        const hp = hurt.getComponent("health")
        const mult = 2 - (((hp.currentValue + baseDamage) / hp.defaultValue))
        e.damage = e.damage * mult
    }
});