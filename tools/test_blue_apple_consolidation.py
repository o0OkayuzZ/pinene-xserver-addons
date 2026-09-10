"""Regression checks for replacing legacy apples without changing reward balance."""
from pathlib import Path
import json
import subprocess
import unittest

ROOT = Path(__file__).resolve().parents[1]
BASE = 'aea85120954a8b74033b86253c17a04b691dab21'
BP15 = 'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639'
BP08 = 'behavior_packs/bp_08_2c5e0de8-0360-49ac-bfe5-339a2a0e62f2'
BP03 = 'behavior_packs/bp_03_969b1f80-d29c-454f-ab4e-9798b508c1fc'
STEMS = ('blue_apple', 'blue_diamond_apple', 'enchanted_blue_diamond_apple')
BOSSES = ('ancient_guardian', 'arch_illager', 'boss_wildfire', 'corrupted_cauldron',
          'endersent', 'fiery_forge', 'jungle_abomination', 'mooshroom_monstrosity',
          'nameless_one', 'obsidian_monstrosity', 'spooky_monstrosity',
          'tempest_golem', 'vengeful_heart_of_ender', 'wretched_wraith')
REMOVED = {f'{BP15}/items/{s}.item.json' for s in STEMS} | {
    f'{BP15}/recipes/{s}.recipe.json' for s in STEMS[1:]}
CHESTS = {f'{BP08}/loot_tables/chests/diamond_chest/{s}.json' for s in BOSSES}
APPROVED_RUNTIME_PATHS = REMOVED | CHESTS

def original(path):
    return subprocess.check_output(['git', 'show', f'{BASE}:{path}'], cwd=ROOT)

class BlueAppleConsolidation(unittest.TestCase):
    def test_old_definitions_and_duplicate_recipes_are_removed(self):
        for path in REMOVED:
            self.assertFalse((ROOT / path).exists(), path)

    def test_boss_rewards_only_change_the_item_identifier(self):
        for path in CHESTS:
            before = original(path)
            self.assertEqual(before.count(b'myname:blue_apple'), 1)
            actual = (ROOT / path).read_bytes()
            self.assertEqual(actual, before.replace(b'myname:blue_apple', b'resetapple:blue_apple'), path)
            json.loads(actual)

    def test_canonical_items_recipes_and_effect_script_are_preserved(self):
        canonical = ROOT / BP03
        for path in canonical.rglob('*'):
            if path.is_file():
                self.assertEqual(path.read_bytes(), original(path.relative_to(ROOT).as_posix()), str(path))
        for stem in STEMS:
            definition = json.loads((canonical / f'items/{stem}.item.json').read_text(encoding='utf-8-sig'))
            self.assertEqual(definition['minecraft:item']['description']['identifier'], f'resetapple:{stem}')
        for stem in STEMS[1:]:
            recipe = json.loads((canonical / f'recipes/{stem}.recipe.json').read_text(encoding='utf-8-sig'))['minecraft:recipe_shaped']
            self.assertEqual(recipe['result']['item'], f'resetapple:{stem}')

    def test_no_legacy_ids_in_active_pack_files_or_structures(self):
        needles = [f'myname:{stem}'.encode() for stem in STEMS]
        for folder in ['behavior_packs', 'resource_packs']:
            for path in (ROOT / folder).rglob('*'):
                if path.is_file() and path.suffix in {'.json', '.js', '.mcfunction', '.mcstructure', '.lang'}:
                    data = path.read_bytes()
                    self.assertFalse(any(needle in data for needle in needles), str(path))

if __name__ == '__main__':
    unittest.main()
