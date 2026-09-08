import {
    world,
    system,
    MolangVariableMap
} from "@minecraft/server";

export function addShadowForm(player, duration) {
    if (duration <= 0) return false;
    var timeLeft = world.scoreboard.getObjective('dungeons:shadowform_t');
    if (!timeLeft) {
        timeLeft = world.scoreboard.addObjective('dungeons:shadowform_t');
    }
    if (timeLeft.getScore(player) > duration) return;
    if (!player.hasTag('dungeons:in_shadow_form')) player.removeTag("dungeons:shadow_barb_used")
    player.addTag('dungeons:in_shadow_form');
    timeLeft.setScore(player, duration);
    return true;
}

world.afterEvents.entityDie.subscribe((e) => {
    const deadEntity = e.deadEntity;
    if (deadEntity == undefined) return;
    if (!deadEntity.isValid) return
    if (deadEntity.hasTag("dungeons:in_shadow_form")) {
        var timeLeft = world.scoreboard.getObjective('dungeons:shadowform_t');
        timeLeft.removeParticipant(deadEntity)
        deadEntity.removeTag('dungeons:in_shadow_form');
    }
})

world.afterEvents.itemCompleteUse.subscribe((e) => {
    const { itemStack, source } = e;
    if (itemStack.typeId == "minecraft:milk_bucket") {
        if (source.hasTag("dungeons:in_shadow_form")) {
            var timeLeft = world.scoreboard.getObjective('dungeons:shadowform_t');
            timeLeft.removeParticipant(source)
            source.removeTag('dungeons:in_shadow_form');
        }
    }
})

world.beforeEvents.entityHurt.subscribe((e) => {
    const player = e.damageSource.damagingEntity;
    if (!player) return;
    if (!player.isValid) return;
    if (player.typeId !== "minecraft:player") return;
    if (e.damageSource.cause == "override") return;

    var timeLeft = world.scoreboard.getObjective('dungeons:shadowform_t');
    if (!timeLeft) return;
    if (!timeLeft.hasParticipant(player.scoreboardIdentity)) return;
    e.damage = 6 + (e.damage * 1.3)
    const dim = player.dimension
    const loc = player.location
    var removeShadowForm = true
    const projectile = e.damageSource.damagingProjectile;
    if (projectile) {
        if (projectile.hasTag("dungeons:shadow_barb_bow_effect")) {
            removeShadowForm = false
        }
    }
    system.run(() => {
        if (removeShadowForm == true || player.hasTag("dungeons:shadow_barb_used")) {
            dim.spawnParticle("dungeons:shadow_break", loc)
            dim.playSound("artefact.shadow_break", loc)
            timeLeft.removeParticipant(player)
            player.removeTag('dungeons:in_shadow_form');
            player.addTag('dungeons:exited_shadow_form');
            player.removeEffect("invisibility")
            system.runTimeout(() => {
                player.removeTag('dungeons:exited_shadow_form');
            }, 5);
        } else {
            player.addTag("dungeons:shadow_barb_used")
            dim.playSound("artefact.shadow_break", loc, { volume: 0.5, pitch: 0.5 })
        }
    })
});

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const dim = player.dimension;
        var timeLeft = world.scoreboard.getObjective('dungeons:shadowform_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);
        if (duration % 2 == 0) {
            var rgbMap = new MolangVariableMap()
            rgbMap.setColorRGB("variable.color", { red: 0.1, green: 0, blue: 0.2 })

            dim.spawnParticle("dungeons:potion_ambient", player.location, rgbMap)
        }
        if (duration > 0) {
            timeLeft.addScore(player, -1);
            player.addEffect('invisibility', duration, { amplifier: 0, showParticles: false });

            player.playAnimation('animation.shadow', { nextState: 'shadowForm' });
        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
            player.removeTag('dungeons:in_shadow_form');
        }
    }
});