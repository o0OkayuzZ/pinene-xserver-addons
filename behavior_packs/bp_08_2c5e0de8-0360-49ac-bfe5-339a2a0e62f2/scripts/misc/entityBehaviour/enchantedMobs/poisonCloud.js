import {
    world,
    system,
    DimensionTypes
} from "@minecraft/server";

const id = "poison_cloud"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const hurt = e.hurtEntity;
        if (!hurt) return;
        if (!hurt.isValid) return;
        var cd = world.scoreboard.getObjective('dungeons:poison_cloud_t');
        if (!cd) {
            cd = world.scoreboard.addObjective('dungeons:poison_cloud_t');
        }
        if (cd.hasParticipant(damageSource)) {
            return;
        }
        const dim = hurt.dimension
        const hurtLoc = hurt.location;
        cd.setScore(damageSource, 80)
        if (damageSource.matches({ families: ["boss"] })) cd.setScore(damageSource, 160)
        dim.playSound('weapon.enchant.poison', hurtLoc)
        var duration = 12
        if (world.getDifficulty() == "Easy") duration = 8
        createPoisonCloud(duration, dim, hurtLoc, damageSource)
    }
});

//cooldown
system.runInterval(() => {
    for (const dimensionType of DimensionTypes.getAll()) {
        const dim = world.getDimension(dimensionType.typeId)
        for (const entity of dim.getEntities({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:poison_cloud_t');
            if (!timeLeft) return;
            if (!entity.scoreboardIdentity) continue;
            if (!timeLeft.hasParticipant(entity.scoreboardIdentity)) continue;
            let duration = timeLeft.getScore(entity);

            if (duration > 0) {
                timeLeft.addScore(entity, -1);
            }
            if (duration <= 0) {
                timeLeft.removeParticipant(entity)
            }
        }
    }
})

//cloud
function createPoisonCloud(timeLeft, dim, loc, owner) {
    if (timeLeft <= 0) return;
    if (timeLeft > 1) {
        dim.spawnParticle("dungeons:enemy_poison_cloud_smoke", loc)
        dim.spawnParticle("dungeons:enemy_poison_cloud_swirls", loc)
    }
    const damageRange = dim.getEntities({
        location: loc,
        maxDistance: 3,
        families: ["player"]
    });
    for (const target of damageRange) {
        var damage = 3
        const damageDone = target.applyDamage(damage, { cause: "magic" })
        if (damageDone) {
            target.applyKnockback({ x: 0, z: 0 }, -0.1)
            target.addEffect("fatal_poison", 11)
        }
    }
    system.runTimeout(() => {
        createPoisonCloud(timeLeft - 1, dim, loc, owner)
    }, 10)
}