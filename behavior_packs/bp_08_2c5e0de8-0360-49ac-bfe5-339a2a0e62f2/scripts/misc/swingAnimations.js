import {
    world,
    system
} from "@minecraft/server";

function swingSound(sound, e, dim, loc, v, p) {
    if (e.swingSource !== "Attack") return;
    dim.playSound(sound, loc, { volume: v, pitch: p })
}

system.beforeEvents.startup.subscribe((event) => {
    event.itemComponentRegistry.registerCustomComponent('dungeons:custom_swing', {
    });
});

world.afterEvents.playerSwingStart.subscribe((e) => {
    const heldItem = e.heldItemStack;
    if (!heldItem) return;
    const customSwingComponent = heldItem.getComponent("dungeons:custom_swing")
    if (!customSwingComponent) return;
    const params = customSwingComponent.customComponentParameters.params
    const player = e.player
    if (params.has_cooldown == true && heldItem.typeId.includes("sawblade") == false) {
        var cd = heldItem.getComponent("cooldown")
        if (cd !== undefined) {
            const timeLeft = player.getItemCooldown(heldItem.getComponent("cooldown").cooldownCategory)
            if (timeLeft > 0 && timeLeft < cd.cooldownTicks - 2) {
                return;
            }
        }
    }
    //sound
    if (params.swing_sound !== undefined) {
        const dim = player.dimension
        const loc = player.location
        swingSound(params.swing_sound, e, dim, loc, 1, 1)
        if (params.delay_sound !== undefined) {
            for (const duration of params.delay_sound) {
                system.runTimeout(() => {
                    swingSound(params.swing_sound, e, dim, player.location, 1, 0.9)
                }, Math.ceil(duration))
            }
        }
    }
    //animations
    if (params.animation !== undefined) {
        player.playAnimation(`animation.${params.animation}.dummy1`, { controller: `dummy`, stopExpression: `t.player_name = '${player?.name}'; t.melee_attack = 1; return true; ` })
    }
    if (params.third_person_animation !== undefined) {
        player.playAnimation(params.third_person_animation)
    }

    if (params.has_cooldown == true && heldItem.typeId.includes("sawblade") == false) {
        //starting cooldown for misses
        system.runTimeout(() => {
            cd = heldItem.getComponent("cooldown")
            if (cd !== undefined && e.swingSource == "Attack") {
                if (player.getItemCooldown(cd.cooldownCategory) == 0) player.startItemCooldown(cd.cooldownCategory, cd.cooldownTicks);
            }
        }, 1)
    }
})