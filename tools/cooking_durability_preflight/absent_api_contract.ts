import { world } from '@minecraft/server';
// @ts-expect-error exact published package lacks this after-event
world.afterEvents.playerCraftRecipe;
// @ts-expect-error exact published package lacks this before-event
world.beforeEvents.playerCraftRecipe;
