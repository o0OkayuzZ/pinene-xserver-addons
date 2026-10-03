import {
    world,
    system,
    ItemStack
} from "@minecraft/server";

system.beforeEvents.startup.subscribe((event) => {
    event.blockComponentRegistry.registerCustomComponent('dungeons:ancient_barrier', {

        onTick(e) {
            const block = e.block;
            const dim = e.dimension;
            const mobs = dim.getEntitiesAtBlockLocation(block.location)
            for (const mob of mobs) {
                const oDim = mob.getDynamicProperty("dungeons:ancient_origindim")
                if (!oDim) continue;
                if (oDim !== dim.id) continue;
                const oLoc = mob.getDynamicProperty("dungeons:ancient_originloc")
                if (!oLoc) continue;
                if (!dim.isChunkLoaded(oLoc)) continue;
                const tp = mob.tryTeleport(oLoc)
                if (tp) {
                    mob.addEffect("slowness", 20, { amplifier: 100, showParticles: false })
                    mob.addEffect("regeneration", 50, { amplifier: 2, showParticles: false })
                }
            }
        }
    })
})
