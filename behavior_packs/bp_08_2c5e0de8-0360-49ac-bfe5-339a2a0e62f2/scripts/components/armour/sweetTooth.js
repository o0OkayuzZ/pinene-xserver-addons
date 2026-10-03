import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (isWearingSet(player, "dungeons:sweet_tooth_armour") == false) continue;

        const lvl = player.level
        system.runTimeout(() => {
            if(player.isValid && player.level > lvl) {
                var cd = world.scoreboard.getObjective('dungeons:sweet_tooth_t');
                if (!cd) {
                    cd = world.scoreboard.addObjective('dungeons:sweet_tooth_t');
                }
                if (cd.hasParticipant(player.scoreboardIdentity)) {
                    return;
                }
                cd.setScore(player, 40)
                
                const dim = player.dimension;
                const loc = player.getHeadLocation()
                system.runTimeout(() => {
                    dim.playSound("firework.launch", loc)
                }, 5)
                for (let i = 0; i < 10; i++) {
                    system.runTimeout(() => {
                        var loc2 = {
                            x: loc.x,
                            y: loc.y + (0.8 * i * 1),
                            z: loc.z
                        };
                        dim.spawnParticle("dungeons:firework_arrow", loc2)
                    }, 5 + (i * 1))
                    
                    system.runTimeout(() => {
                        var loc2 = {
                            x: loc.x,
                            y: loc.y + (0.4 * i * 1),
                            z: loc.z
                        };
                        dim.spawnParticle("dungeons:firework_arrow", loc2)
                    }, 5 + (i * 1))
                }
                system.runTimeout(() => {
                    var loc2 = {
                        x: loc.x,
                        y: loc.y + 8,
                        z: loc.z
                    };
                    dim.spawnParticle("dungeons:sparkler_hit", loc2)
                    dim.spawnParticle("dungeons:firework_arrow_2", { x: loc2.x, y: loc2.y - 0.2, z: loc2.z })
                    //dim.spawnParticle("dungeons:firework_arrow_1", loc)
                    dim.spawnParticle("dungeons:firework_arrow_0", loc2)
                    dim.playSound("random.explode", loc2, { pitch: 1.1 })
                    dim.playSound("firework.twinkle", loc2, { pitch: 1.1 })
                }, 15)
            }
        },2)

        if(Math.random() > 0.05) continue;
        player.runCommand("particle minecraft:basic_smoke_particle ^^2.5^")
    }
})

// TIMER
system.runInterval(() => {
    for (const player of world.getPlayers()) {
        var timeLeft = world.scoreboard.getObjective('dungeons:sweet_tooth_t');
        if (!timeLeft) return;
        if (!player.scoreboardIdentity) continue;
        if (!timeLeft.hasParticipant(player.scoreboardIdentity)) continue;
        let duration = timeLeft.getScore(player);

        if (duration > 0) {
            timeLeft.addScore(player, -1);
        }
        if (duration <= 0) {
            timeLeft.removeParticipant(player)
        }
    }
});
