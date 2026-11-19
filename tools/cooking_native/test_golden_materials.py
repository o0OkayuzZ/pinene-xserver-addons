"""Check actual material costs, container ownership and cross-pack compatibility."""
import copy
import json
import unittest
from collections import Counter

from build_catalog100 import FOOD, RP, TOOLS, generated_files, load_catalog, validate_catalog
from compiler import CONTAINER_RETURNS, compile_recipe, native_counts, parse_data
from golden_materials import ROOT, golden_recipe_rows, ingredient_registry, load_golden_spec, material_id


class GoldenMaterialsTests(unittest.TestCase):
    def setUp(self):
        self.catalog = load_catalog()
        self.rows = golden_recipe_rows(self.catalog)

    def test_exact_cost_and_sequential_upgrade_on_a_workbench(self):
        self.assertEqual(len(self.rows), 14)
        for row in self.rows:
            enchanted = row['material_tier'] == 'enchanted_golden'
            coating = 'minecraft:gold_block' if enchanted else 'minecraft:gold_ingot'
            source = row['ingredients'][0]['id']
            if enchanted:
                self.assertTrue(source.startswith('pine:golden_'))
            else:
                self.assertIn(source, {x['id'] for x in self.catalog['materials']})
            for _, recipe in compile_recipe(row):
                body = recipe['minecraft:recipe_shaped']
                self.assertEqual(body['tags'], ['crafting_table'])
                self.assertEqual(native_counts(recipe), Counter({source: 1, coating: 8}))
                center = body['pattern'][1][1]
                self.assertEqual(body['key'][center]['item'], source)
                self.assertEqual(body['result'], {'item': row['id'], 'count': 1})
                self.assertEqual(body['unlock'], {'context': 'AlwaysUnlocked'})

    def test_gilding_never_returns_a_second_container(self):
        for row in self.rows:
            recipe = compile_recipe(row)[0][1]['minecraft:recipe_shaped']
            self.assertIsInstance(recipe['result'], dict)
        for slug in ('milk_bottle', 'cooking_oil', 'gelatin'):
            for enchanted in (False, True):
                self.assertEqual(CONTAINER_RETURNS[material_id('pine:' + slug, enchanted)], 'minecraft:glass_bottle')

    def test_cooking_with_each_golden_vessel_returns_it_once(self):
        for ident, vessel in CONTAINER_RETURNS.items():
            if ident not in ingredient_registry():
                continue
            row = {'id': 'pine:test_gold_meal', 'rank': 7, 'resultCount': 1,
                   'ingredients': [{'id': ident, 'count': 2}]}
            body = compile_recipe(row)[0][1]['minecraft:recipe_shaped']
            self.assertEqual(body['result'], [{'item': row['id'], 'count': 1}, {'item': vessel, 'count': 2}])

    def test_new_materials_are_not_edible_and_enchanted_versions_share_gold_art(self):
        files = generated_files(self.catalog)
        for row in self.rows:
            slug = row['id'].split(':')[1]
            item = json.loads(files[FOOD / 'items' / (slug + '.json')])['minecraft:item']
            components = item['components']
            self.assertNotIn('minecraft:food', components)
            self.assertNotIn('pine:meal_effects', components)
            self.assertEqual(components['minecraft:glint'], row['material_tier'] == 'enchanted_golden')
            self.assertEqual(components['minecraft:icon'], slug.removeprefix('enchanted_'))

    def test_existing_golden_food_identifiers_are_reused_and_accepted_as_ingredients(self):
        registry = ingredient_registry()
        for ident in ('minecraft:golden_apple', 'minecraft:enchanted_golden_apple',
                      'minecraft:golden_carrot', 'minecraft:glistering_melon_slice',
                      'a:gwheat', 'a:egwheat', 'pinene:golden_potato',
                      'pinene:enchanted_golden_carrot', 'a:gmbucket'):
            self.assertIn(ident, registry)
            catalog = copy.deepcopy(self.catalog)
            target = next(r for r in catalog['dishes'] if r['id'] == 'pine:apple_bread')
            target['ingredients'][1]['id'] = ident
            validate_catalog(catalog)
        self.catalog['dishes'][0]['ingredients'][0]['id'] = 'a:invented_gold'
        with self.assertRaises(AssertionError):
            validate_catalog(self.catalog)

    def test_external_pack_is_optional_but_references_match_it_when_present(self):
        pack = ROOT / 'behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880'
        if not pack.exists():
            self.skipTest('Optional existing golden-food pack is not mounted')
        existing = {json.loads(p.read_text(encoding='utf-8-sig'))['minecraft:item']['description']['identifier']
                    for p in (pack / 'items').glob('*.json')}
        for row in load_golden_spec()['existing_ingredients']:
            if row['source'] != 'vanilla':
                self.assertIn(row['id'], existing)

    def test_material_recipes_do_not_bill_a_cutting_board_or_change_dish_counts(self):
        files = generated_files(self.catalog)
        recipes = parse_data(files[TOOLS / 'scripts/cooking_data.js'])
        self.assertEqual(sum(r['rank'] > 0 for r in recipes), 100)
        self.assertEqual(sum(r['rank'] == 0 for r in recipes), 21)
        runtime = json.loads(files[TOOLS / 'scripts/cooking_runtime.js'].split('Object.freeze(', 1)[1].split(');', 1)[0])
        for row in self.rows:
            self.assertNotIn(row['id'], runtime)
            self.assertIn(FOOD / 'recipes/golden' / (row['id'].split(':')[1] + '.json'), files)

    def test_rank_x_is_accepted_and_above_x_rejected(self):
        row = {'id': 'pine:test', 'rank': 10, 'resultCount': 1, 'ingredients': [{'id': 'a:egwheat', 'count': 1}]}
        code = lambda: 'export const COOKING_RECIPES = ' + json.dumps([row]) + '; export const CATEGORY_ORDER = [10];'
        self.assertEqual(parse_data(code())[0]['rank'], 10)
        row['rank'] = 11
        with self.assertRaises(ValueError):
            parse_data(code())


if __name__ == '__main__':
    unittest.main(verbosity=2)
