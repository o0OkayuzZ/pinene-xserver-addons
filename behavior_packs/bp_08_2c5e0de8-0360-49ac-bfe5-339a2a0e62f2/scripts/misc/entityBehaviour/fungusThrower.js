import {
    world
} from "@minecraft/server";

//FUNGUS THROWER VFX
world.afterEvents.entityHurt.subscribe((event) => {
    const hurtEntity = event.hurtEntity;
    const damageSource = event.damageSource.damagingEntity;
    if (!damageSource) return;
    if (damageSource.typeId === "dungeons:piglin_fungus_thrower") {
        hurtEntity.dimension.spawnParticle('dungeons:nethershroom_boom', hurtEntity.location);
    }
});