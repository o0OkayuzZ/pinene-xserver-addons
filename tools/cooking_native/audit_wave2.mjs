/**
 * Cooking wave-2 readiness audit. No game files are changed by this tool.
 * Default: progress report, exit 0. --strict fails until all 27 dishes are ready.
 * --catalog-only validates the approved lineup without checking game artifacts.
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const catalogPath = path.join(root, 'docs', 'cooking_ui', 'approved-wave2-20261015.json');
const bpFood = path.join(root, 'behavior_packs', 'bp_18_7e540260-69ce-4a82-951d-bc793e151cd5');
const bpTools = path.join(root, 'behavior_packs', 'bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4');
const rpFood = path.join(root, 'resource_packs', 'rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2');
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8').replace(/^\uFEFF/, ''));
const expectedFamilyCounts = {
  gelatin: 4, chocolate: 3, cheese: 6, butter: 5,
  noodles: 2, cooking_oil: 4, milk_bottle: 3,
};

export function validateCatalog(data) {
  assert.equal(data.schema_version, 1);
  assert.equal(data.expectations.dish_count, 27);
  assert.equal(data.dishes.length, 27);
  assert.deepEqual(data.expectations.family_counts, expectedFamilyCounts);
  const ids = new Set();
  const names = new Set();
  const counts = Object.fromEntries(Object.keys(expectedFamilyCounts).map(f => [f, 0]));
  for (const dish of data.dishes) {
    assert.match(dish.proposed_id, /^pine:[a-z0-9_]+$/);
    assert.equal(typeof dish.name_ja, 'string');
    assert.ok(dish.name_ja.length > 0);
    assert.ok(!ids.has(dish.proposed_id), 'duplicate id: ' + dish.proposed_id);
    assert.ok(!names.has(dish.name_ja), 'duplicate name: ' + dish.name_ja);
    assert.ok(Object.hasOwn(counts, dish.family), 'unknown family: ' + dish.family);
    ids.add(dish.proposed_id);
    names.add(dish.name_ja);
    counts[dish.family]++;
  }
  assert.deepEqual(counts, expectedFamilyCounts);
}

export function audit(rootPath = root, data = catalog) {
  validateCatalog(data);
  const foodBP = path.join(rootPath, 'behavior_packs', 'bp_18_7e540260-69ce-4a82-951d-bc793e151cd5');
  const toolsBP = path.join(rootPath, 'behavior_packs', 'bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4');
  const foodRP = path.join(rootPath, 'resource_packs', 'rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2');
  const dataPath = path.join(toolsBP, 'scripts', 'cooking_data.js');
  const localizationPath = path.join(foodRP, 'texts', 'ja_JP.lang');
  const code = existsSync(dataPath) ? readFileSync(dataPath, 'utf8') : '';
  const localized = existsSync(localizationPath) ? readFileSync(localizationPath, 'utf8') : '';
  const dishes = data.dishes.map(dish => {
    const slug = dish.proposed_id.split(':')[1];
    const checks = {
      id_approved: dish.id_approved === true,
      design_approved:
        Number.isInteger(dish.rank) && dish.rank >= 0 && dish.rank <= 7 &&
        Array.isArray(dish.ingredients) && dish.ingredients.length > 0 &&
        Number.isInteger(dish.result_count) && dish.result_count >= 1 &&
        Number.isFinite(dish.nutrition) && Number.isFinite(dish.saturation),
      item: existsSync(path.join(foodBP, 'items', slug + '.json')),
      native_recipe: existsSync(path.join(toolsBP, 'recipes', 'native', slug + '.json')),
      registry: code.includes('"id": "' + dish.proposed_id + '"'),
      texture: existsSync(path.join(foodRP, 'textures', 'items', slug + '.png')),
      japanese: localized.includes('item.' + dish.proposed_id + '.name='),
      placed_model: existsSync(path.join(foodBP, 'entities', 'meshy_food', slug + '.json')),
    };
    return {
      dish: dish.name_ja,
      proposed_id: dish.proposed_id,
      family: dish.family,
      ready: Object.values(checks).every(Boolean),
      missing: Object.entries(checks).filter(([, ok]) => !ok).map(([key]) => key),
    };
  });
  return {
    total: dishes.length,
    ready: dishes.filter(d => d.ready).length,
    incomplete: dishes.filter(d => !d.ready).length,
    dishes,
  };
}

validateCatalog(catalog);
const args = new Set(process.argv.slice(2));
if (args.has('--catalog-only')) {
  console.log('APPROVED_WAVE2_CATALOG_OK (27 dishes, 7 families)');
} else {
  const result = audit();
  if (args.has('--json')) console.log(JSON.stringify(result, null, 2));
  else {
    console.log('Wave-2 implementation readiness: ' + result.ready + '/' + result.total);
    for (const d of result.dishes) {
      console.log((d.ready ? 'READY ' : 'TODO  ') + d.dish + ' [' + d.proposed_id + ']' +
        (d.ready ? '' : ' — ' + d.missing.join(', ')));
    }
  }
  if (args.has('--strict') && result.incomplete) process.exitCode = 1;
}
