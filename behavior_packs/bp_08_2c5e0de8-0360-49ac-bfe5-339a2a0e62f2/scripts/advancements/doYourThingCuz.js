import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js"

world.afterEvents.itemStartUse.subscribe((e) => {
    if(!advancementsEnabled) return;
    const { itemStack, source } = e;
    if (!itemStack) return;
    if (itemStack.getComponent("dungeons:broken_sawblade")) {
        source.addTag("dungeons:doyourthingcuz")
        source.setDynamicProperty("dungeons:do_your_thing_count", 0)
    }
})
world.afterEvents.itemStopUse.subscribe((e) => {
    if(!advancementsEnabled) return;
    const { itemStack, source } = e;
    if (!itemStack) return;
    if (itemStack.getComponent("dungeons:broken_sawblade")) {
        source.removeTag("dungeons:doyourthingcuz")
        source.setDynamicProperty("dungeons:do_your_thing_count", null)
    }
})
world.afterEvents.playerSpawn.subscribe((e) => {
    if(!advancementsEnabled) return;
    e.player.removeTag("dungeons:doyourthingcuz")
    e.player.setDynamicProperty("dungeons:do_your_thing_count", null)
})

world.afterEvents.entityHurt.subscribe((e) => {
    if(!advancementsEnabled) return;
    const { damageSource } = e;
    if (!damageSource) return;
    const damagingEntity = damageSource.damagingEntity;
    if (!damagingEntity) return;
    if (damagingEntity.isValid == false) return;
    if (!damagingEntity.hasTag("adv:dungeons:do_your_thing_cuz"))
        if (damagingEntity.hasTag("dungeons:doyourthingcuz")) {
            const counter = damagingEntity.getDynamicProperty("dungeons:do_your_thing_count")
            if (counter <= 8) {
                damagingEntity.setDynamicProperty("dungeons:do_your_thing_count", counter + 1)
            } else {
                grantAdvancement(damagingEntity, "dungeons:do_your_thing_cuz")
                damagingEntity.setDynamicProperty("dungeons:do_your_thing_count", null)
            }
        }
})