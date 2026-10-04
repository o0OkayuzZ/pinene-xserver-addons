import test from 'node:test';
import assert from 'node:assert/strict';
import { COOKING_RECIPES } from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/cooking_data.js';
import {
  unlockIdsForRecipe,
  parseDiscovery,
  serializeDiscovery,
  discoverFromItems,
  isRecipeDiscovered
} from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/recipe_discovery.js';

test('all seven rank-0 recipes are visible without discovery state', () => {
  const found = parseDiscovery(undefined);
  const basic = COOKING_RECIPES.filter(recipe => recipe.rank === 0);
  assert.equal(basic.length, 7);
  assert(basic.every(recipe => isRecipeDiscovered(recipe, found)));
});

test('higher-rank recipes remain hidden until their unlock material is acquired', () => {
  const recipe = COOKING_RECIPES.find(row => row.id === 'pine:carrot_salad');
  assert.deepEqual(unlockIdsForRecipe(recipe), ['minecraft:carrot']);
  assert.equal(isRecipeDiscovered(recipe, parseDiscovery('')), false);
  const next = discoverFromItems('', ['minecraft:carrot']);
  assert(next.newly.includes(recipe.id));
  assert.equal(isRecipeDiscovered(recipe, parseDiscovery(next.value)), true);
});

test('one shared ingredient can discover every matching recipe without duplicates', () => {
  const expected = COOKING_RECIPES
    .filter(recipe => recipe.rank > 0 && unlockIdsForRecipe(recipe).includes('minecraft:bread'))
    .map(recipe => recipe.id)
    .sort();
  const first = discoverFromItems('', ['minecraft:bread']);
  assert.deepEqual(first.newly.sort(), expected);
  const second = discoverFromItems(first.value, ['minecraft:bread']);
  assert.deepEqual(second.newly, []);
  assert.equal(second.value, first.value);
});

test('obtaining a finished dish also migrates that dish to discovered', () => {
  const next = discoverFromItems('', ['pine:beef_stew']);
  assert(next.newly.includes('pine:beef_stew'));
});

test('invalid and rank-0 ids never pollute persistent discovery state', () => {
  const parsed = parseDiscovery('pine:milk_bottle|garbage|pine:carrot_salad');
  assert.deepEqual([...parsed], ['pine:carrot_salad']);
  assert.equal(serializeDiscovery(parsed), 'pine:carrot_salad');
});
