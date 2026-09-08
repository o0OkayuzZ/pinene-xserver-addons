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
    if (!isWearingSet(hurt, "dungeons:nimble_turtle_armour")) return;
    if (hurt.getEffect("speed")) {
        if (hurt.getEffect("speed").amplifier >= 4) return;
    }
    const dim = hurt.dimension
    const loc = hurt.location;
    dim.spawnParticle('dungeons:swiftness', loc)
    dim.playSound("armour.rush.activate", loc)
    hurt.addEffect("speed", 33, { amplifier: 4 })

});