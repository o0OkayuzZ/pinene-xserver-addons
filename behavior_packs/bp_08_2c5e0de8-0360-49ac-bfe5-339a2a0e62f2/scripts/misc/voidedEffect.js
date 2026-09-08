import {
    world,
    system,
    MolangVariableMap
} from "@minecraft/server";

export function addVoidedEffect(entity, duration) {
    if (duration <= 0) return false;
    var timeLeft = world.scoreboard.getObjective('dungeons:voided_t');
    if (!timeLeft) {
        timeLeft = world.scoreboard.addObjective('dungeons:voided_t');
    }

    entity.addTag('dungeons:voided_effect');
    timeLeft.setScore(entity, duration);
    return true;
}

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (deadEntity == undefined) return;
    if (!deadEntity.isValid) return
    if (deadEntity.hasTag("dungeons:voided_effect")) {
        var timeLeft = world.scoreboard.getObjective('dungeons:voided_t');
        timeLeft.removeParticipant(deadEntity)
        deadEntity.removeTag('dungeons:voided_effect');
    }
})

world.afterEvents.itemCompleteUse.subscribe((e) => {
    const { itemStack, source } = e;
    if (itemStack.typeId == "minecraft:milk_bucket") {
        if (source.hasTag("dungeons:voided_effect")) {
            var timeLeft = world.scoreboard.getObjective('dungeons:voided_t');
            timeLeft.removeParticipant(source)
            source.removeTag('dungeons:voided_effect');
        }
    }
})


world.beforeEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (e.damageSource.cause == "override") return;
    if (hurt.hasTag("dungeons:voided_effect")) {
        if (hurt.matches({ families: ["boss"] })) {
            e.damage = e.damage * 1.25
        } else {
            e.damage = e.damage * 2
        }
    }
})

// TIMER
const dimIds = ["overworld", "nether", "the_end"]

system.runInterval(() => {
    for (const dimId of dimIds) {
        const dim = world.getDimension(dimId)
        for (const entity of dim.getEntities({ tags: ["dungeons:voided_effect"] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:voided_t');
            if (!timeLeft) return;
            if (!timeLeft.hasParticipant(entity)) continue;
            let duration = timeLeft.getScore(entity);
            if (duration % 10 == 0 && dim.isChunkLoaded(entity.location)) dim.spawnParticle("dungeons:voided_smoke", entity.location)
            if (duration % 8 == 0 && dim.isChunkLoaded(entity.location)) dim.spawnParticle("dungeons:voided_stars", entity.location)

            if (duration > 0) {
                timeLeft.addScore(entity, -1);
            }
            if (duration <= 0) {
                timeLeft.removeParticipant(entity)
                entity.removeTag('dungeons:voided_effect');
            }
        }
    }
});