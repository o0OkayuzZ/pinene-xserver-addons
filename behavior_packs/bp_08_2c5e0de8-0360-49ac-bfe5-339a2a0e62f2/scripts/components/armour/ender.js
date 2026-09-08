import {
    world,
    system,
    EntityDamageCause
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

world.afterEvents.entityHurt.subscribe((e) => {
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (hurt.typeId !== "minecraft:player") return;
    if (!isWearingSet(hurt, "dungeons:ender_armour")) return;
    if (Math.random() > 0.1) return;
    var dim = hurt.dimension
    var loc = hurt.location;
    dim.spawnParticle('dungeons:instant_teleoort', { x: loc.x, y: loc.y + 1, z: loc.z })
    dim.playSound("entity.player.teleport", loc, { pitch: 1.3 })
    dim.spawnParticle('dungeons:teleport_out', loc);
    hurt.runCommand('spreadplayers ~ ~ 3.0 8.0 @s ~2');
    system.runTimeout(() => {
        dim = hurt.dimension
        loc = hurt.location;
        dim.spawnParticle('dungeons:instant_teleoort', { x: loc.x, y: loc.y + 1, z: loc.z })
        dim.playSound("entity.player.teleport", loc, { pitch: 1.3 })
        dim.spawnParticle('dungeons:teleport_in', loc);
    }, 3)
});