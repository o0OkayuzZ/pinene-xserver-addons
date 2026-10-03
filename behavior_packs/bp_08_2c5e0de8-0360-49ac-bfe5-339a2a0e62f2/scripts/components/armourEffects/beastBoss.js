import {
    world,
    system
} from "@minecraft/server";

import { isWearingSet } from "components/armour.js"

//attack boost
world.beforeEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (e.damageSource.cause == "override") return;
    if (damageSource.matches({ families: ["pet", "artefact"] })) {
        const cause = e.damageSource.cause
        if (cause == "lightning") return;
        const tameable = damageSource.getComponent("tameable")
        if (!tameable) return;
        const owner = tameable.tamedToPlayer
        if (!owner || !isWearingSet(owner, "dungeons:beast_boss")) return;
        e.damage = e.damage * 1.25
    }
});
