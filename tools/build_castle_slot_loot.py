"""Build BSL slot tables while preserving each source pool's expected draws."""
import copy
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TABLES = ROOT / 'behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/infinite_castle'

def expected(pool):
    rolls = pool['rolls']
    count = (rolls['min'] + rolls['max']) / 2 if isinstance(rolls, dict) else rolls
    for condition in pool.get('conditions', []):
        assert condition['condition'] == 'random_chance'
        count *= condition['chance']
    return count

def build():
    outputs = {}
    for path in sorted(TABLES.glob('*.json')):
        pools = json.loads(path.read_text(encoding='utf-8-sig'))['pools']
        base = copy.deepcopy(pools[0])
        assert not base.get('conditions') and expected(base) >= 1
        base['rolls'] = 1
        outputs[f'{path.stem}_base.json'] = {'pools': [base]}
        entries = [{'type': 'loot_table', 'name': f'loot_tables/chests/infinite_castle/slots/{path.stem}_base.json',
                    'weight': round((expected(pools[0]) - 1) * 100)}]
        for pool in pools[1:]:
            assert len(pool['entries']) == 1
            entry = copy.deepcopy(pool['entries'][0])
            assert not entry.get('conditions') and not pool.get('functions')
            entry['weight'] = round(expected(pool) * 100)
            entries.append(entry)
        empty = 2600 - sum(entry['weight'] for entry in entries)
        assert empty > 0
        entries.append({'type': 'empty', 'weight': empty})
        outputs[f'{path.stem}.json'] = {'pools': [{'rolls': 1, 'entries': entries}]}
    return outputs

if __name__ == '__main__':
    directory = TABLES / 'slots'
    directory.mkdir(exist_ok=True)
    for name, data in build().items():
        (directory / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('Built 14 BSL slot tables (7 guaranteed + 7 empty-inclusive).')
