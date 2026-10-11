import { world, system } from "@minecraft/server";
import { rejectNaturalTraderDuplicate } from "./trader_density_policy.js";

world.afterEvents.entitySpawn.subscribe(event => {
    if (event.cause !== "Spawned") return;
    try {
        if (!event.entity.isValid || event.entity.typeId !== "minecraft:wandering_trader") return;
        // Let other after-event listeners finish. Companions are matched by their
        // exact leash holder, never by proximity alone.
        system.runTimeout(() => {
            try { rejectNaturalTraderDuplicate(event.entity, event.cause); }
            catch (error) { console.warn(`[Pinene trader density] ${error}`); }
        }, 5);
    } catch (error) { console.warn(`[Pinene trader density] ${error}`); }
});
