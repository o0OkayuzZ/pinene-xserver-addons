import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return
    const entity = e.entity;
    if (entity.typeId == "dungeons:nameless_one") entity.addTag("adv:unknown_allegiance_ready")
})

world.afterEvents.entityHurt.subscribe((e) => {
    if(!advancementsEnabled) return
    const hurt = e.hurtEntity;
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:unknown_allegiance_ready")) return
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (e.damageSource.cause !== "entityAttack" && e.damageSource.cause !== "projectiles") return;
    if (damager.typeId !== "minecraft:player") return;
    const held = damager.getComponent("equippable").getEquipment("Mainhand")
    if (!held) hurt.removeTag("adv:unknown_allegiance_ready")
    if (held.typeId !== "dungeons:glaive" && held.typeId !== "dungeons:venom_glaive" && held.typeId !== "dungeons:grave_bane" && held.typeId !== "dungeons:cackling_broom") hurt.removeTag("adv:unknown_allegiance_ready")

})

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (!damager.hasTag("aly:dungeons_enabled")) return;
    if (damager.hasTag("adv:dungeons:unknown_allegiance")) return;
    const hurt = e.deadEntity
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:unknown_allegiance_ready")) return;
    grantAdvancement(damager, "dungeons:unknown_allegiance")
})