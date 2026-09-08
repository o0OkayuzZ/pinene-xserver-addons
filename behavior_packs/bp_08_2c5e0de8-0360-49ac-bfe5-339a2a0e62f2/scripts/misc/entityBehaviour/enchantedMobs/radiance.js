import {
    world
} from "@minecraft/server";

const id = "radiance"

world.afterEvents.entityHurt.subscribe((e) => {
    const damageSource = e.damageSource.damagingEntity;
    if (!damageSource) return;
    if (!damageSource.isValid) return;
    if (damageSource.matches({ families: ["enchanted"], tags: ["dungeons:enchanted_mob_" + id] })) {
        const dim = damageSource.dimension;
        if (!dim.isChunkLoaded(damageSource.location)) return;
        const loc = { x: damageSource.location.x, y: damageSource.location.y + 1, z: damageSource.location.z }
        dim.spawnParticle("dungeons:radiance_aura", loc)
        dim.spawnParticle("dungeons:radiance_aura2", loc)
        const heal = dim.getEntities({ location: loc, maxDistance: 3 })
        for (const target of heal) {
            if (heal.typeId == damageSource.typeId || heal.typeId == damageSource.typeId.replace("dungeons:enchanted_", "dungeons:") || heal.typeId == damageSource.typeId.replace("dungeons:enchanted_", "minecraft:")) {
                const hp = target.getComponent("health")
                if (hp.currentValue + 8 <= hp.defaultValue) {
                    hp.setCurrentValue(hp.currentValue + 8)
                } else {
                    hp.setCurrentValue(hp.defaultValue)
                }
            }
        }
    }
});