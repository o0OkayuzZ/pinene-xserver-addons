import { world, system, BlockVolume } from "@minecraft/server";
import {hunts} from "./main.js"

system.afterEvents.scriptEventReceive.subscribe((e) => {
    const id = e.id;
    if (id !== "dungeons:testlightning") return;
    const player = e.sourceEntity;
    player.playSound("ambient.weather.thunder", { volume: 1, pitch: 0.6 + Math.random() * 0.6 })
    system.runTimeout(() => {
        strikeLightning(player, player.dimension)
    }, 5)
})

function strikeLightning(player, dim) {
    const loc = player.location;
    const corner1 = {
        x: loc.x - 16,
        y: loc.y,
        z: loc.z - 16
    }
    const corner2 = {
        x: loc.x + 16,
        y: loc.y + 8,
        z: loc.z + 16
    }
    const volume = new BlockVolume(corner1, corner2)
    for (const pos of volume.getBlockLocationIterator()) {
        if (!dim.isChunkLoaded(pos)) continue;
        const block = dim.getBlock(pos)
        if (!block || block.isAir) continue;
        if (block.typeId == "dungeons:woodland_mansion_window") {
            block.setType("dungeons:woodland_mansion_window_bright")
            system.runTimeout(() => {
                block.setType("dungeons:woodland_mansion_window")
                system.runTimeout(() => {
                    block.setType("dungeons:woodland_mansion_window_bright")
                    system.runTimeout(() => {
                        block.setType("dungeons:woodland_mansion_window")
                    }, 2)
                }, 2)
            }, 4)
        }
    }
}


system.runInterval(() => {
    if (!hunts) return;
    if (Math.random() < 0.66) return;
    for (const player of world.getDimension("dungeons:ancientdim_ominous_castle").getPlayers()) {
        player.playSound("ambient.weather.thunder", { volume: 1, pitch: 0.6 + Math.random() * 0.6 })
        system.runTimeout(() => {
            strikeLightning(player, player.dimension)
        }, 5)
    }

}, 100)
