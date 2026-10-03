import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return;
    const entity = e.entity;
    if (entity.typeId == "dungeons:redstone_monstrosity") entity.addTag("adv:metal_to_metal_ready")
})

world.afterEvents.entityHurt.subscribe((e) => {
    if(!advancementsEnabled) return;
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:metal_to_metal_ready")) return
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (damager.getComponent("equippable").totalArmor >= 20) hurt.removeTag("adv:metal_to_metal_ready")
})

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return;
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (!damager.hasTag("aly:dungeons_enabled")) return;
    if (damager.hasTag("adv:dungeons:metal_to_metal")) return;
    const hurt = e.deadEntity
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:metal_to_metal_ready")) return;
    grantAdvancement(damager, "dungeons:metal_to_metal")
})