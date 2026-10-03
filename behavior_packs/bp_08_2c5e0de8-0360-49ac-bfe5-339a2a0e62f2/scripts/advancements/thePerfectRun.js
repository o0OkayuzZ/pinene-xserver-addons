import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return;
    const entity = e.entity;
    if (entity.typeId == "dungeons:vengeful_heart_of_ender") entity.addTag("adv:the_perfect_run_ready")
})

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return;
    const dead = e.deadEntity;
    if (!dead) return;
    if (!dead.isValid) return;
    if (dead.typeId !== "minecraft:player") return;
    const targets = dead.dimension.getEntities({ tags: ["adv:the_perfect_run_ready"], maxDistance: 100, location: dead.location })
    for (const target of targets) target.removeTag("adv:the_perfect_run_ready")
})

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return;
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (!damager.hasTag("aly:dungeons_enabled")) return;
    if (damager.hasTag("adv:dungeons:the_perfect_run")) return;
    const hurt = e.deadEntity
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:the_perfect_run_ready")) return;
    grantAdvancement(damager, "dungeons:the_perfect_run")
})