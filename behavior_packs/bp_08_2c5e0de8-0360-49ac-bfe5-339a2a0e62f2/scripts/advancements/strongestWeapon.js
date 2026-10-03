import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return;
    const entity = e.entity;
    if (entity.typeId == "dungeons:jungle_abomination") entity.addTag("adv:strongest_weapon_ready")
})

world.afterEvents.entityHurt.subscribe((e) => {
    if(!advancementsEnabled) return;
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:strongest_weapon_ready")) return
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (e.damageSource.cause !== "entityAttack" && e.damageSource.cause !== "projectiles") return;
    if (damager.typeId !== "minecraft:player") return;
    const held = damager.getComponent("equippable").getEquipment("Mainhand")
    if (!held) hurt.removeTag("adv:strongest_weapon_ready")
    if (held.typeId !== "dungeons:firebrand") hurt.removeTag("adv:strongest_weapon_ready")

})

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return;
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (!damager.hasTag("aly:dungeons_enabled")) return;
    if (damager.hasTag("adv:dungeons:strongest_weapon")) return;
    const hurt = e.deadEntity
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:strongest_weapon_ready")) return;
    grantAdvancement(damager, "dungeons:strongest_weapon")
})