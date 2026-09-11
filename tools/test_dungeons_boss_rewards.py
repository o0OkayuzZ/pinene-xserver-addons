"""Run with python tools/test_dungeons_boss_rewards.py (standard library only)."""
from pathlib import Path
from fractions import Fraction
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]
BP = next(ROOT.glob('behavior_packs/bp_08_*'))
CHESTS = BP / 'loot_tables/chests/diamond_chest'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def armor_probability(path, visiting=()):
    if path in visiting:
        raise AssertionError(f'Loot table cycle: {path}')
    no_armor = Fraction(1)
    for pool in read(path)['pools']:
        entries = pool['entries']
        def outcome(e):
            if e['type'] == 'loot_table':
                return armor_probability(BP / e['name'], visiting + (path,))
            name = e.get('name', '')
            return Fraction(name.startswith('dungeons:') and name.endswith(('_helmet', '_chestplate', '_leggings', '_boots')))
        if len(entries) == 1:
            e = entries[0]
            probability = outcome(e)
            for condition in e.get('conditions', []):
                assert condition['condition'] == 'random_chance'
                probability *= Fraction(str(condition['chance']))
        else:
            assert not any(e.get('conditions') for e in entries)
            total = sum(e.get('weight', 1) for e in entries)
            probability = sum(e.get('weight', 1) * outcome(e) for e in entries) / total
        rolls = pool['rolls']
        rolls = list(range(rolls['min'], rolls['max'] + 1)) if isinstance(rolls, dict) else [rolls]
        no_armor *= sum((1 - probability) ** r for r in rolls) / len(rolls)
    return 1 - no_armor

class BossRewards(unittest.TestCase):
    def test_reward_quantities(self):
        for path in CHESTS.glob('*.json'):
            pools = read(path)['pools']
            with self.subTest(boss=path.stem):
                self.assertEqual(pools[0]['rolls'], 2)
                mineral_rolls = 4 if path.stem in {'corrupted_cauldron', 'mooshroom_monstrosity', 'vengeful_heart_of_ender'} else 3
                self.assertEqual(pools[-2]['rolls'], mineral_rolls)
                for pool in pools:
                    names = [e.get('name') for e in pool['entries']]
                    if 'dungeons:diamond_dust' in names:
                        self.assertEqual(pool['rolls'], 4 if path.stem == 'vengeful_heart_of_ender' else 3)
                    if any(e['type'] == 'loot_table' for e in pool['entries']):
                        self.assertEqual(pool['rolls'], {'min': 3, 'max': 4} if path.stem == 'spooky_monstrosity' else 2)

    def test_armor_tables_are_only_their_own_set(self):
        paths = list((CHESTS / 'armor').rglob('*.json'))
        self.assertEqual(len(paths), 133)
        for path in paths:
            with self.subTest(path=path.relative_to(BP)):
                for pool in read(path)['pools']:
                    self.assertEqual(pool['rolls'], 1)
                    self.assertTrue(pool['entries'])
                    for entry in pool['entries']:
                        name = entry['name']
                        if entry['type'] == 'loot_table':
                            self.assertTrue(name.startswith(f'loot_tables/chests/diamond_chest/armor/{path.parent.name}/'))
                            self.assertTrue((BP / name).is_file())
                        else:
                            self.assertTrue(name.startswith(f'dungeons:{path.parent.name}_'), name)
                if path.stem != 'base':
                    self.assertEqual(read(path)['pools'][0]['entries'][0]['name'], f'dungeons:{path.parent.name}_{path.stem}')
                # Selecting an armor subtable must now always give armor.
                self.assertEqual(armor_probability(path), 1)

    def test_world_manifest_versions_and_order(self):
        manifests = [read(p) for p in ROOT.glob('*_packs/*/manifest.json')]
        headers = {m['header']['uuid']: m['header']['version'] for m in manifests}
        # The unused standalone Waystone item BP/RP have been removed.
        self.assertEqual(len(headers), 35)
        for manifest in manifests:
            for module in manifest['modules']:
                self.assertEqual(module['version'], manifest['header']['version'])
            for dep in manifest.get('dependencies', []):
                if 'uuid' in dep:
                    self.assertEqual(dep['version'], headers[dep['uuid']])
        for kind, count in [('behavior', 16), ('resource', 19)]:
            path = ROOT / f'world_{kind}_packs.json'
            self.assertEqual(path.read_bytes(), (ROOT / 'worlds/Bedrock level' / path.name).read_bytes())
            rows = read(path)
            self.assertEqual(len(rows), count)
            self.assertEqual(len({r['pack_id'] for r in rows}), count)
            for row in rows:
                self.assertEqual(row['version'], headers[row['pack_id']])

    def test_boss_tables_have_valid_armor_paths(self):
        paths = list(CHESTS.glob('*.json'))
        self.assertEqual(len(paths), 14)
        for path in paths:
            probability = armor_probability(path)
            if path.stem == 'spooky_monstrosity':
                rolls = read(path)['pools'][3]['rolls']
                expected = 1 - sum(Fraction(8, 11) ** r for r in range(rolls['min'], rolls['max'] + 1)) / (rolls['max'] - rolls['min'] + 1)
            elif path.stem == 'vengeful_heart_of_ender':
                expected = Fraction(1)
            else:
                rolls = read(path)['pools'][6]['rolls']
                expected = 1 - Fraction(1, 4) ** rolls
            self.assertEqual(probability, expected, path.name)

if __name__ == '__main__':
    unittest.main()
