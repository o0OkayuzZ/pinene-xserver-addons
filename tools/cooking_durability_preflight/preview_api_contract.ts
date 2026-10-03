import { world, type PlayerCraftRecipeAfterEvent } from '@minecraft/server';
world.afterEvents.playerCraftRecipe.subscribe((e:PlayerCraftRecipeAfterEvent)=>{ e.block; e.itemStack; e.player;
// @ts-expect-error the notification cannot be cancelled
e.cancel=true;
// @ts-expect-error recipe ID is not supplied by this event
e.recipeId; });
// @ts-expect-error Preview still has no craft-before event
world.beforeEvents.playerCraftRecipe;
