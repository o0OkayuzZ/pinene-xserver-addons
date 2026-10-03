"""Run with python tools/test_dungeons_boss_rewards.py (standard library only)."""
from pathlib import Path
from fractions import Fraction
import json
import unittest

ROOT = Path(__file__).resolve().parents[1]
BP = next(ROOT.glob('behavior_packs/bp_08_*'))
CHESTS = BP / 'loot_tables/chests/diamond_chest'

def _strip_jsonc(text):
    out = []
    i = 0
    in_string = False
    escape = False
    while i < len(text):
        c = text[i]
        if in_string:
            out.append(c)
            if escape:
                escape = False
            elif c == '\\':
                escape = True
            elif c == '"':
                in_string = False
            i += 1
            continue
        if c == '"':
            in_string = True
            out.append(c)
            i += 1
            continue
        if c == '/' and i + 1 < len(text) and text[i + 1] == '/':
            i += 2
            while i < len(text) and text[i] not in '\r\n':
                i += 1
            continue
        if c == '/' and i + 1 < len(text) and text[i + 1] == '*':
            i += 2
            while i + 1 < len(text) and not (text[i] == '*' and text[i + 1] == '/'):
                i += 1
            i += 2
            continue
        out.append(c)
        i += 1
    text = ''.join(out)
    while True:
        cleaned = __import__('re').sub(r',(\s*[}\]])', r'\1', text)
        if cleaned == text:
            return cleaned
        text = cleaned

def read(path):
    return json.loads(_strip_jsonc(path.read_text(encoding='utf-8-sig')))

def version_tuple(version):
    if isinstance(version, str):
        core = version.split('-', 1)[0].split('+', 1)[0]
        return tuple(int(x) for x in core.split('.'))
    return tuple(version)

BOSS_TABLES = {
    'ancient_guardian', 'arch_illager', 'boss_wildfire', 'corrupted_cauldron',
    'endersent', 'fiery_forge', 'jungle_abomination', 'mooshroom_monstrosity',
    'nameless_one', 'obsidian_monstrosity', 'spooky_monstrosity',
    'tempest_golem', 'vengeful_heart_of_ender', 'wretched_wraith',
}

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
        paths = [CHESTS / f'{name}.json' for name in sorted(BOSS_TABLES)]
        self.assertTrue(all(path.is_file() for path in paths))
        for path in paths:
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
        self.assertEqual(len(paths), 175)
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
        bp_manifest = read(BP / 'manifest.json')
        rp_path = next(ROOT.glob('resource_packs/rp_06_*/manifest.json'))
        rp_manifest = read(rp_path)
        headers = {
            bp_manifest['header']['uuid']: bp_manifest['header']['version'],
            rp_manifest['header']['uuid']: rp_manifest['header']['version'],
        }
        for manifest in (bp_manifest, rp_manifest):
            for module in manifest['modules']:
                self.assertEqual(version_tuple(module['version']), version_tuple(manifest['header']['version']))
            for dep in manifest.get('dependencies', []):
                if dep.get('uuid') in headers:
                    self.assertEqual(version_tuple(dep['version']), version_tuple(headers[dep['uuid']]))

        for kind, pack_id in [
            ('behavior', bp_manifest['header']['uuid']),
            ('resource', rp_manifest['header']['uuid']),
        ]:
            path = ROOT / f'world_{kind}_packs.json'
            self.assertEqual(path.read_bytes(), (ROOT / 'worlds/Bedrock level' / path.name).read_bytes())
            rows = read(path)
            matches = [row for row in rows if row['pack_id'] == pack_id]
            self.assertEqual(len(matches), 1)
            self.assertEqual(version_tuple(matches[0]['version']), version_tuple(headers[pack_id]))

    def test_boss_tables_have_valid_armor_paths(self):
        all_paths = list(CHESTS.glob('*.json'))
        self.assertEqual(len(all_paths), 15)
        self.assertTrue((CHESTS / 'pig.json').is_file())
        paths = [CHESTS / f'{name}.json' for name in sorted(BOSS_TABLES)]
        self.assertEqual(len(paths), 14)
        for path in paths:
            with self.subTest(boss=path.stem):
                probability = armor_probability(path)
                self.assertGreaterEqual(probability, 0)
                self.assertLessEqual(probability, 1)
                for pool in read(path)['pools']:
                    for entry in pool['entries']:
                        if entry['type'] == 'loot_table':
                            self.assertTrue((BP / entry['name']).is_file(), entry['name'])

if __name__ == '__main__':
    unittest.main()
