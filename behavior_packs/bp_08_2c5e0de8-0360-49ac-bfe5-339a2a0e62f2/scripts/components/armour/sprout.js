import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isValidTarget, specialDamage } from "main.js"
import { isWearingSet } from "components/armour.js"

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (player.isSprinting && isWearingSet(player, "dungeons:sprout_armour")) {
            const nearbyMobs = player.dimension.getEntities({ location: player.location, maxDistance: 3.5, excludeFamilies: ['inanimate', "ignore"] });
            for (const mob of nearbyMobs) {
                if (isValidTarget(mob) == false) continue;
                if (mob !== player) {
                    if (mob.typeId == "minecraft:player") {
                        if (mob.getEffect("poison")) continue;
                        const damage = specialDamage(player, mob, 1, EntityDamageCause.magic, ["poison"])
                        if (!damage) continue
                        mob.applyKnockback({ x: 0, z: 0 }, -0.2)
                        mob.addEffect("poison", 40, { amplifier: 2 })
                        mob.addEffect("slowness", 40, { amplifier: 1, showParticles: false })
                    } else {
                        if (mob.getEffect("fatal_poison")) continue;
                        const damage = specialDamage(player, mob, 2, EntityDamageCause.magic, ["poison"])
                        if (!damage) continue
                        mob.applyKnockback({ x: 0, z: 0 }, -0.2)
                        mob.addEffect("fatal_poison", 50, { amplifier: 2 })
                        mob.addEffect("slowness", 50, { amplifier: 2, showParticles: false })
                    }
                    mob.dimension.spawnParticle("dungeons:sprout_armour_smoke", mob.location)
                    mob.dimension.spawnParticle("dungeons:sprout_armour_smoke", mob.location)
                    mob.dimension.spawnParticle("dungeons:sprout_armour_smoke", mob.location)
                }
            }

        }
    }
}, 15);

system.runInterval(() => {
    for (const player of world.getPlayers({ excludeGameModes: ["Spectator"] })) {
        if (player.isSprinting && isWearingSet(player, "dungeons:sprout_armour")) {
            player.dimension.spawnParticle("dungeons:sprout_armour_smoke", player.location)
        }
    }
}, 1);