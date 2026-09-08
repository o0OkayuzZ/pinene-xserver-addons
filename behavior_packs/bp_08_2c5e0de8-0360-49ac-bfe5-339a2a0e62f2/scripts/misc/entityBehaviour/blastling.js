import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

// Impact Sound
world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt || !hurt.isValid) return;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker || !attacker.isValid) return;
    const projectile = e.damageSource.damagingProjectile;
    if (!projectile) return;
    if (attacker.typeId.includes("blastling") && projectile.typeId === "dungeons:blastling_ammo") {

        hurt.dimension.playSound("mob.blastling.impact", hurt.location)

    }
});