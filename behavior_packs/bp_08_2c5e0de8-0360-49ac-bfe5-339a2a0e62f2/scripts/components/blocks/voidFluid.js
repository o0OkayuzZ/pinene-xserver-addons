import {
    world,
    system
} from "@minecraft/server";

import { addVoidedEffect } from "misc/voidedEffect.js"

function borderGenerating(dimensionId) {
    try {
        if (!dimensionId.includes("dungeons:ancientdim_")) return false;
        return world.getDynamicProperty("dungeons:generating_border_blocks") === true;
    } catch {
        return false;
    }
}

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent("dungeons:void_fluid", {
        onTick(e) {
            const { block, dimension } = e;
            if (borderGenerating(dimension.id)) return;
            if (dimension.isChunkLoaded(block.location) == false) return;
            const mobs = dimension.getEntitiesAtBlockLocation(block.location)
            for (const mob of mobs) {
                if(mob.typeId == "minecraft:player" && mob.getGameMode() == "Spectator") continue;
                if (mob.typeId == "minecraft:item" || mob.typeId == "minecraft:xp_orb") continue;
                if (mob.matches({ excludeFamilies: ["ignore", "inanimate", "endersent", "enderling", "enderman", "endermite", "vengeful_heart_of_ender"] })) {
                    if (mob.typeIdd !== "minecraft:item" && mob.typeId !== "minecraft:xp_orb") addVoidedEffect(mob, 100)
                    mob.addEffect("slowness", 100, { amplifier: 0, showParticles: false })
                    if (mob.typeId == "minecraft:player" && mob.dimension.id.includes("dungeons:ancientdim") == false) {
                        if (Math.floor(mob.getHeadLocation().y) == block.y) {
                            mob.addEffect("blindness", 10, { amplifier: 0, showParticles: false })
                        }
                    }
                }
            }
            if(block.typeId !== "dungeons:void_breath" && block.above() && block.above().typeId == "minecraft:fire") block.above().setType("dungeons:void_breath")
        }
    });
})

world.beforeEvents.playerBreakBlock.subscribe((e) => {
    const player = e.player;
    const block = e.block;
    if (!block.getComponent("dungeons:void_fluid")) return;
    if(block.typeId !== "dungeons:void_breath") return;
    if (player.getGameMode() == "Creative") return;
    const held = player.getComponent("minecraft:equippable").getEquipment("Mainhand")
    if (!held) return;
    const enchant = held.getComponent("minecraft:enchantable")
    if (!enchant) return;
    if (!enchant.getEnchantment("silk_touch")) return;
    e.cancel = true;
    system.run(() => {
        block.dimension.runCommand(`setblock ${block.location.x} ${block.location.y} ${block.location.z} air destroy`)
    })
})