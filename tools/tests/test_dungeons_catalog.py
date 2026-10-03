"""Prevent upstream Dungeons catalog entries duplicating integrated catalog items."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ownership', ROOT / 'tools/audit_pack_ownership.py')
ownership = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ownership)


class DungeonsCatalogTests(unittest.TestCase):
    def test_active_catalogs_register_each_item_once(self):
        owners = {}
        for path in ROOT.glob('behavior_packs/*/item_catalog/*.json'):
            catalog = ownership.load_jsonc(path)['minecraft:crafting_items_catalog']
            for category in catalog['categories']:
                for group in category['groups']:
                    for item in group['items']:
                        item = item if isinstance(item, str) else item['name']
                        self.assertNotIn(item, owners, f'{item}: {owners.get(item)} and {path}')
                        owners[item] = path
        # Old entries remain available through the integrated catalog; new 2.1.3
        # entries remain available through the Dungeons catalog.
        for item in ('dungeons:redstone_key', 'dungeons:sword', 'dungeons:trial_key_stone', 'dungeons:trial_totem_blackstone'):
            self.assertIn(item, owners)


if __name__ == '__main__':
    unittest.main()
