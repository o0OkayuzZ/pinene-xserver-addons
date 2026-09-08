import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:whip', {
        onHitEntity(e, { params }) {
            if (e.hadEffect == false) return;
            const attacker = e.attackingEntity;
            const hit = e.hitEntity;
            const unique = params.unique
            if (!attacker.isValid || !hit.isValid) return;

            const dim = hit.dimension
            const loc = hit.location
            if (unique == false) dim.playSound('weapon.whip.hit.common', loc)
            if (unique == true) dim.playSound('weapon.whip.hit.unique', loc)
            system.runTimeout(() => {
                dim.spawnParticle('dungeons:whip_crack', loc)
                dim.spawnParticle('dungeons:whip_sparks', loc)
            }, 5);

        }
    });
});