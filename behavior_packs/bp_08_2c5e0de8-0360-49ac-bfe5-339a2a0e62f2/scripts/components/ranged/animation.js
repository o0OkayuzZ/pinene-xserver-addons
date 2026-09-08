import {
    world,
    system
} from "@minecraft/server";

world.afterEvents.itemStartUse.subscribe((e) => {
    const item = e.itemStack;
    const player = e.source;
    if (item.hasTag("dungeons:bow")) {
        player.playAnimation("animation.player.draw_bow", { blendOutTime: 0.0, stopExpression: "!q.is_using_item" })
    }//if (item.hasTag("dungeons:crossbow")) player.playAnimation("animation.player.load_crossbow", { blendOutTime: 0.0, stopExpression: "!q.is_using_item" })

})
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        const heldItem = player.getComponent("minecraft:equippable").getEquipment("Mainhand");
        if (!heldItem) continue;
        if (heldItem.hasTag("dungeons:crossbow")) {
            if (heldItem.getDynamicProperty("dungeons:loaded") !== true) continue;

            if (player.hasTag("dungeons:in_shadow_form")) continue;
            if (heldItem.hasTag("dungeons:dual_wielded_crossbow")) {
                player.playAnimation('animation.player.dual_crossbows_hold', { blendOutTime: 0.3, nextState: 'crossbowDraw' })
            } else {
                player.playAnimation('animation.player.greatsword_hold', { blendOutTime: 0.3, nextState: 'crossbowDraw' })
            }
        }
    }
});