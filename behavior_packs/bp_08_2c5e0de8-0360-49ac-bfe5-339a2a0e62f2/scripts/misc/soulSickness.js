import {
    world,
    system,
    MolangVariableMap,
    EntityDamageCause
} from "@minecraft/server";
import {getSoulBarText} from "misc/soulManager.js"

const immune = [

]

export function addSoulEffect(entity, duration) {
    if(immune.includes(entity.typeId)) return
    if (duration <= 0) return false;
    var timeLeft = world.scoreboard.getObjective('dungeons:soulsick_t');
    if (!timeLeft) {
        timeLeft = world.scoreboard.addObjective('dungeons:soulsick_t');
    }

    entity.addTag('dungeons:soulsick_effect');
    timeLeft.setScore(entity, duration);
    return true;
}

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (deadEntity == undefined) return;
    if (!deadEntity.isValid) return
    if (deadEntity.hasTag("dungeons:soulsick_effect")) {
        var timeLeft = world.scoreboard.getObjective('dungeons:soulsick_t');
        timeLeft.removeParticipant(deadEntity)
        deadEntity.removeTag('dungeons:soulsick_effect');
    }
})

world.afterEvents.itemCompleteUse.subscribe((e) => {
    const { itemStack, source } = e;
    if (itemStack.typeId == "minecraft:milk_bucket") {
        if (source.hasTag("dungeons:soulsick_effect")) {
            var timeLeft = world.scoreboard.getObjective('dungeons:soulsick_t');
            timeLeft.removeParticipant(source)
            source.removeTag('dungeons:soulsick_effect');
        }
    }
})
system.afterEvents.scriptEventReceive.subscribe((e) => {
    if(e.id == "dungeons:soulsick") addSoulEffect(e.sourceEntity, 100)
})

// TIMER

system.runInterval(() => {
    const dims = []
    for (const player of world.getPlayers()) if (!dims.includes(player.dimension.id)) dims.push(player.dimension.id)
    for (const dimensionType of dims) {
        const dim = world.getDimension(dimensionType)
        for (const entity of dim.getEntities({ tags: ["dungeons:soulsick_effect"] })) {
            var timeLeft = world.scoreboard.getObjective('dungeons:soulsick_t');
            if (!timeLeft) return;
            if (!timeLeft.hasParticipant(entity)) continue;
            let duration = timeLeft.getScore(entity);
            if(dim.isChunkLoaded(entity.location)) {
                const box = entity.getAABB()
                const h = Math.round(box.extent.y * 100) / 50
                const w = Math.round(box.extent.x * 100) / 50
                var map = new MolangVariableMap()

                map.setFloat("variable.radius", w)
                map.setFloat("variable.height", h)
                dim.spawnParticle("dungeons:soulsick_fire", entity.location, map)
                if (duration % 10 == 0) dim.spawnParticle("dungeons:soulsick_souls", entity.location, map)
                if (duration % 4 == 0) dim.spawnParticle("dungeons:soulsick_smoke", entity.location, map)
            }
            if(duration % 12 == 0) {
                const hurt = entity.applyDamage(1, {cause: EntityDamageCause.magic})
                if(hurt && entity.typeId == "minecraft:player") {
                    entity.playSound("mob.player.hurt_on_fire", {pitch:0.7})
                    if(world.scoreboard.getObjective("soulGauge").getScore(entity) > 0) {
                        if(dim.isChunkLoaded(entity.location) && Math.random() > 0.5) dim.spawnParticle("dungeons:soul2", entity.getHeadLocation())
                        world.scoreboard.getObjective("soulGauge").addScore(entity, -1)
                        system.runTimeout(() => {
                            entity.onScreenDisplay.setActionBar(getSoulBarText(entity, true))
                        },1)//entity.onScreenDisplay.setActionbar(getSoulBarText(entity, true))
                    }
                }
            }

            if (duration > 0) {
                timeLeft.addScore(entity, -1);
            }
            if (duration <= 0) {
                timeLeft.removeParticipant(entity)
                entity.removeTag('dungeons:soulsick_effect');
            }
        }
    }
});
