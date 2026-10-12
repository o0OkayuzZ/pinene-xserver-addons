import { world, ItemStack } from "@minecraft/server";
import { shouldRecoverBuddingAmethyst } from "./budding_amethyst_policy.js";

export function recoverBuddingAmethyst(event) {
    if (!shouldRecoverBuddingAmethyst(event, world.gameRules.doTileDrops)) return false;
    const {x,y,z} = event.block.location;
    event.dimension.spawnItem(new ItemStack("minecraft:budding_amethyst", 1), {x:x+.5,y:y+.5,z:z+.5});
    return true;
}
// Native after-event fires only after a successful break. Cancelled protection
// checks, explosions, creative mode and /setblock never receive extra loot.
world.afterEvents.playerBreakBlock.subscribe(recoverBuddingAmethyst);
