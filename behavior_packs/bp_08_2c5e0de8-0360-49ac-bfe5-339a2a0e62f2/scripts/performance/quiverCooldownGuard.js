import { system, world } from "@minecraft/server";

// All six quiver modules used to poll every player independently each tick.
// Keep the exact cooldown-locking behavior, but do one player pass for all
// common/rare quiver categories.
const QUIVER_COOLDOWNS = Object.freeze([
    "firework_quiver",
    "firework_quiver_rare",
    "flaming_quiver",
    "flaming_quiver_rare",
    "harpoon_quiver",
    "harpoon_quiver_rare",
    "thundering_quiver",
    "thundering_quiver_rare",
    "torment_quiver",
    "torment_quiver_rare",
    "void_quiver",
    "void_quiver_rare",
]);

system.runInterval(() => {
    for (const player of world.getPlayers()) {
        for (const cooldownName of QUIVER_COOLDOWNS) {
            const cd = player.getItemCooldown(cooldownName);
            const property = "dungeons:" + cooldownName + "_cooldown";
            if (cd <= 10) continue;
            if (cd <= 21) {
                player.setDynamicProperty(property, undefined);
                continue;
            }
            if (!player.getDynamicProperty(property)) {
                system.runTimeout(() => {
                    if (player.isValid && !player.getDynamicProperty(property)) {
                        player.setDynamicProperty(property, player.getItemCooldown(cooldownName));
                    }
                }, 1);
                continue;
            }
            const current = player.getDynamicProperty(property);
            if (cd > 20 && cd >= current - 3) {
                system.runTimeout(() => {
                    const arrowSlot = player.getDynamicProperty("dungeons:arrow_slot");
                    const arrowCount = player.getDynamicProperty("dungeons:arrow_count");
                    const slotName = cooldownName.replace("_quiver", "").replace("_rare", "");
                    if (arrowSlot === slotName && arrowCount >= 0 && player.isValid) {
                        player.startItemCooldown(cooldownName, current);
                    }
                }, 1);
            }
        }
    }
});
