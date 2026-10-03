
import {
    system,
    world
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:spider_egg", {
        onPlayerBreak(e) {
            const player = e.player;
            const block = e.block;
            if (player.getGameMode() == "Creative") return;
            const equippable = player.getComponent("equippable")
            if (!equippable) return;
            const held = equippable.getEquipment("Mainhand")
            if (held) {
                const enchantable = held.getComponent("enchantable")
                if (enchantable) {
                    if (enchantable.getEnchantment("silk_touch")) return;
                }
            }
            block.dimension.spawnEntity("minecraft:xp_orb", block.center())
            if (Math.random() > 0.7 && world.gameRules.doMobSpawning && world.getDifficulty() !== "Peaceful") {
                block.dimension.spawnEntity("minecraft:cave_spider", block.bottomCenter(), { spawnEvent: "minecraft:become_neutral" })
            }
        }
    });
})