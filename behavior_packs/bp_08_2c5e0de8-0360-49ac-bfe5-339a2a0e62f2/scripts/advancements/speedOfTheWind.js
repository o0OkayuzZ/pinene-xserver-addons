import { world, system, DimensionTypes } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.entitySpawn.subscribe((e) => {
    if(!advancementsEnabled) return;
    const entity = e.entity;
    if (entity.typeId == "dungeons:tempest_golem") entity.addTag("adv:speed_of_the_wind_ready")
})

system.runInterval(() => {
    if(!advancementsEnabled) return;
    for (const dimension of DimensionTypes.getAll()) {
        for (const golem of world.getDimension(dimension.typeId).getEntities({ tags: ["adv:speed_of_the_wind_ready"] })) {
            const timer = golem.getDynamicProperty("adv:sotw_timer")
            if (timer == undefined) {
                golem.setDynamicProperty("adv:sotw_timer", 2400)

            } else if (timer > 0) {
                golem.setDynamicProperty("adv:sotw_timer", timer - 1)
            } else if (timer <= 0) {
                golem.removeTag("adv:speed_of_the_wind_ready")
                golem.setDynamicProperty("adv:sotw_timer", null)

            }
        }
    }
})

world.afterEvents.entityDie.subscribe((e) => {
    if(!advancementsEnabled) return;
    const damager = e.damageSource.damagingEntity;
    if (!damager) return;
    if (!damager.isValid) return;
    if (damager.typeId !== "minecraft:player") return;
    if (!damager.hasTag("aly:dungeons_enabled")) return;
    if (damager.hasTag("adv:dungeons:speed_of_the_wind")) return;
    const hurt = e.deadEntity
    if (!hurt) return;
    if (!hurt.isValid) return;
    if (!hurt.hasTag("adv:speed_of_the_wind_ready")) return;
    grantAdvancement(damager, "dungeons:speed_of_the_wind")
})