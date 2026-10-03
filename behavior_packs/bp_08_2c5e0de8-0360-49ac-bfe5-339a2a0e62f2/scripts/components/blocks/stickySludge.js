
import {
    system,
    world
} from "@minecraft/server";

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (player.isOnGround) {
            system.runTimeout(() => {
                if (player.isJumping && !player.isOnGround) {
                    const dim = player.dimension;
                    const block = dim.getBlock(player.location)
                    if (block.typeId == "dungeons:sticky_sludge" && !block.isWaterlogged) {
                        player.applyImpulse({ x: 0, y: -0.15, z: 0 })
                    }
                }
            }, 1)
        }
    }
})