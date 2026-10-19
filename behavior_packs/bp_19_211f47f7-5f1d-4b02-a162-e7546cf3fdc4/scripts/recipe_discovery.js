import { COOKING_RECIPES } from './cooking_data.js';

export const DISCOVERY_KEY = 'pinene_cooking:discoveries_v1';

const DISCOVERABLE_IDS = new Set(
  COOKING_RECIPES.filter(recipe => recipe.rank > 0).map(recipe => recipe.id)
);

export function unlockIdsForRecipe(recipe) {
  const first = recipe?.ingredients?.[0];
  if (!first) return [];
  if (Array.isArray(first.ids)) return [...first.ids];
  return typeof first.id === 'string' ? [first.id] : [];
}

const RECIPES_BY_TRIGGER = new Map();
for (const recipe of COOKING_RECIPES) {
  if (recipe.rank === 0) continue;
  const triggers = new Set([...unlockIdsForRecipe(recipe), recipe.id]);
  for (const itemId of triggers) {
    if (!RECIPES_BY_TRIGGER.has(itemId)) RECIPES_BY_TRIGGER.set(itemId, []);
    RECIPES_BY_TRIGGER.get(itemId).push(recipe.id);
  }
}

export function parseDiscovery(raw) {
  const found = new Set();
  if (typeof raw !== 'string' || raw.length === 0) return found;
  for (const id of raw.split('|')) {
    if (DISCOVERABLE_IDS.has(id)) found.add(id);
  }
  return found;
}

export function serializeDiscovery(found) {
  return [...found].filter(id => DISCOVERABLE_IDS.has(id)).sort().join('|');
}

export function discoverFromItems(raw, itemIds) {
  const found = parseDiscovery(raw);
  const newly = [];
  for (const itemId of new Set(itemIds ?? [])) {
    for (const recipeId of RECIPES_BY_TRIGGER.get(itemId) ?? []) {
      if (found.has(recipeId)) continue;
      found.add(recipeId);
      newly.push(recipeId);
    }
  }
  return { value: serializeDiscovery(found), newly };
}

export function isRecipeDiscovered(recipe, found) {
  return recipe.rank === 0 || found.has(recipe.id);
}
