import { world } from "@minecraft/server";
import { runIslandAbility } from "./ability_gate.js";

const itemUseAbilities = new Map();

export function registerItemUseAbility(itemTypeId, handler) {
  if (itemUseAbilities.has(itemTypeId)) {
    throw new Error(`Duplicate island item-use ability: ${itemTypeId}`);
  }
  itemUseAbilities.set(itemTypeId, handler);
}

world.afterEvents.itemUse.subscribe((event) => {
  const handler = itemUseAbilities.get(event.itemStack.typeId);
  if (!handler) return;
  runIslandAbility(event.source, () => handler(event));
});
