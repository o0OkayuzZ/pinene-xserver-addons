import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"
import { isWearingSet } from "components/armour.js"

// Ghost Armour
system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (player.isSprinting && isWearingSet(player, "dungeons:ghost_kindler")) {

            const nearbyMobs = player.dimension.getEntities({ location: player.location, maxDistance: 3, excludeFamilies: ['player'] });
            for (const mob of nearbyMobs) {
                if (isValidTarget(mob) == false) continue;
                const fire = mob.getComponent("minecraft:onfire")
                if (!fire) {
                    const setOnFire = mob.setOnFire(Math.floor(Math.random() * 4) + 4, true)
                    if (!setOnFire) continue;
                    specialDamage(player, mob, 4, EntityDamageCause.fire, ["fire"])
                    mob.dimension.spawnParticle('dungeons:ghostly_kindler_burn', mob.location)
                    player.dimension.spawnParticle('dungeons:cloaked_skull_idle', player.location)
                    player.dimension.playSound('mob.ghast.fireball', player.location, { volume: 0.3 });
                }
            }
            const nearbyPlayers = player.dimension.getEntities({ location: player.location, maxDistance: 3, families: ['player'] });
            for (const enemyplayer of nearbyPlayers) {
                if (isValidTarget(enemyplayer) == false) continue;
                if (enemyplayer.typeId == "minecraft:player" && enemyplayer.getGameMode() == "Creative") continue;
                if (enemyplayer !== player) {
                    const fire = enemyplayer.getComponent("minecraft:onfire")
                    if (!fire) {
                        const setOnFire = enemyplayer.setOnFire(Math.floor(Math.random() * 0.5) + 0.55, true)
                        if (!setOnFire) continue;
                        specialDamage(player, enemyplayer, 0.5, EntityDamageCause.fire, ["fire"])
                        enemyplayer.dimension.spawnParticle('dungeons:ghostly_kindler_burn', enemyplayer.location)
                        player.dimension.spawnParticle('dungeons:cloaked_skull_idle', player.location)
                        player.dimension.playSound('mob.ghast.fireball', player.location, { volume: 0.3 });
                    }
                }
            }
        }
    }
});