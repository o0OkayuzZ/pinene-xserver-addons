import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

// Enchanted Sheep
world.afterEvents.entityHurt.subscribe((e) => {
    const damage = e.damage;
    const hurt = e.hurtEntity;
    const attacker = e.damageSource.damagingEntity;
    if (!attacker) return;
    if (!attacker.isValid) return;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (attacker.typeId == "dungeons:enchanted_sheep") {
        if (attacker.hasTag('sheep_red')) {
            hurt.setOnFire(damage * 2, true)
        }
        if (attacker.hasTag('sheep_green')) {
            hurt.addEffect("poison", damage * 18, {
                amplifier: 1,
                showParticles: true
            });
        }
        if (attacker.hasTag('sheep_blue')) {
            hurt.addEffect("slowness", 80, {
                amplifier: damage,
                showParticles: true
            });
        }
    }
});