"""Audit Phase 0.5, all active loot tables, and preservation of the Git baseline.

Run: python -X utf8 tools/validate_bsl_phase05.py
Writes docs/bsl/validation.json. No game/server mutations.
"""
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = '8d98749d3abd30cad564b1c28fa5b24a2580ee90'
BSL = 'behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12'
DOC = ROOT / 'docs/bsl'
errors = []


def check(ok, message):
    if not ok:
        errors.append(message)


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotepath=false', *args], cwd=ROOT)


def rel(path):
    return path.relative_to(ROOT).as_posix()


def canonical(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=True).encode()).hexdigest()


def standalone(table, name, chance=None, rolls=1):
    matches = [p for p in table['pools'] if any(e.get('name') == name for e in p['entries'])]
    check(len(matches) == 1, f'{name}: expected exactly one dedicated pool')
    if len(matches) != 1:
        return
    pool = matches[0]
    check(len(pool['entries']) == 1 and pool['rolls'] == rolls, f'{name}: competing entry or wrong rolls')
    expected = [] if chance is None else [{'condition': 'random_chance', 'chance': chance}]
    check(pool.get('conditions', []) == expected and not pool['entries'][0].get('conditions'), f'{name}: wrong probability')


def main():
    provenance = load(DOC / 'provenance.json')
    registrations = [ROOT / 'world_behavior_packs.json', *ROOT.glob('worlds/*/world_behavior_packs.json')]
    active = {r['pack_id'] for r in load(registrations[0])}
    packs = [p.parent for p in ROOT.glob('behavior_packs/*/manifest.json') if load(p)['header']['uuid'] in active]
    definitions = {}
    dungeon_ids = set()
    for pack in packs:
        for folder, key in [('items', 'minecraft:item'), ('blocks', 'minecraft:block')]:
            for path in (pack / folder).rglob('*.json'):
                try:
                    identifier = load(path).get(key, {}).get('description', {}).get('identifier')
                    if identifier:
                        definitions.setdefault(identifier, []).append(rel(path))
                        if pack.name.startswith('bp_08_'):
                            dungeon_ids.add(identifier)
                except Exception as exc:
                    errors.append(f'{rel(path)}: {exc}')

    tables, jsonc = {}, []
    for pack in packs:
        for path in (pack / 'loot_tables').rglob('*.json'):
            try:
                tables[rel(path)] = load(path)
            except json.JSONDecodeError:
                # Preserve pre-existing commented Dungeon JSON; still parse every entry.
                source = path.read_text(encoding='utf-8-sig')
                stripped = re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/',
                                  lambda m: m[0] if m[0].startswith('"') else '', source)
                try:
                    tables[rel(path)] = json.loads(stripped)
                    jsonc.append(rel(path))
                    check(not rel(path).startswith(BSL), f'BSL must be strict JSON: {rel(path)}')
                    check(git('show', BASE + ':' + rel(path)).decode('utf-8-sig').replace('\r\n', '\n') == source,
                          f'Commented JSON changed: {rel(path)}')
                except Exception as exc:
                    errors.append(f'{rel(path)}: {exc}')

    # Vanilla fallback verified against Mojang/bedrock-samples, 2026-09-11.
    vanilla = {'loot_tables/entities/raider_drops.json'}
    refs, custom, graph = [], set(), {}
    for name, table in tables.items():
        graph[name] = []
        for node in walk(table):
            if node.get('type') == 'item':
                item = node['name']
                if ':' in item and not item.startswith('minecraft:'):
                    custom.add(item)
                    check(item in definitions, f'Undefined custom item: {name}: {item}')
            if node.get('type') == 'loot_table':
                target = node['name']
                candidates = [rel(pack / target) for pack in packs if rel(pack / target) in tables]
                check(bool(candidates) or target in vanilla, f'Missing reference: {name}: {target}')
                refs.append({'source': name, 'target': target, 'resolved': candidates or ['vanilla']})
                graph[name].extend(candidates)

    visited = set()
    def visit(name, stack):
        if name in stack:
            errors.append('Loot cycle: ' + ' -> '.join([*stack, name]))
            return
        if name in visited:
            return
        for target in graph.get(name, []):
            visit(target, [*stack, name])
        visited.add(name)
    for name in graph:
        visit(name, [])

    chest_prefix = BSL + '/loot_tables/chests/'
    chests = {n.removeprefix(chest_prefix): d for n, d in tables.items() if n.startswith(chest_prefix)}
    check(set(chests) == set(provenance['profiles']) and len(chests) == 36, '36 chest profile set mismatch')
    bsl_custom = set()
    for name, table in tables.items():
        if not name.startswith(BSL + '/'):
            continue
        for node in walk(table):
            if node.get('type') == 'item':
                item = node['name']
                check(item not in dungeon_ids, f'Dungeon item in BSL: {name}: {item}')
                if name.startswith(chest_prefix) or name.startswith(BSL + '/loot_tables/bsl/'):
                    check(item not in {'minecraft:mace', 'minecraft:heavy_core', 'minecraft:dragon_egg'}, f'Restricted item in BSL chest/subtable: {name}: {item}')
                if ':' in item and not item.startswith('minecraft:'):
                    bsl_custom.add(item)
        if name in provenance['files']:
            check(canonical(table) == provenance['files'][name]['semanticSHA256'], f'ZIP semantics changed: {name}')
        else:
            check(table == json.loads(git('show', BASE + ':' + name)), f'Unrelated BSL table changed: {name}')

    for name, table in chests.items():
        expected = provenance['profiles'][name]
        for item, chance in expected['independentChances'].items():
            standalone(table, item, chance, expected.get('rollOverrides', {}).get(item, 1))
        # CD/figurines may only be reached through the dedicated collectible branch.
        for node in walk(table):
            check(node.get('name') not in provenance['collectibleItems'], f'Direct collectible in {name}')
        for pool in table['pools']:
            for entry in pool['entries']:
                if entry.get('name') == 'loot_tables/bsl/collectibles/all.json':
                    check(len(pool['entries']) == 1, f'Collectibles compete with resources in {name}')

    ice = chests['ancient_city_ice_box.json']
    standalone(ice, 'loot_tables/bsl/food/golden_foods.json', rolls={'min': 2, 'max': 4})
    standalone(ice, 'loot_tables/bsl/food/enchanted_golden_foods.json', rolls={'min': 1, 'max': 3})
    standalone(chests['buriedtreasure.json'], 'minecraft:heart_of_the_sea')
    bastion = chests['bastion_treasure.json']
    standalone(bastion, 'minecraft:netherite_upgrade_smithing_template')
    progression = bastion['pools'][1]
    check(progression == {'rolls': 1, 'entries': [
        {'type': 'item', 'name': 'true_dn:deathnerite_ingot', 'weight': 18},
        {'type': 'item', 'name': 'true_dn:darkness_upgrade_smithing_template', 'weight': 10},
        {'type': 'empty', 'weight': 72}]}, 'Bastion progression must retain ZIP 18/10/72 exclusive roll')
    check('true_dn:deathnerite_upgrade_smithing_template' not in bsl_custom, 'Nonexistent Deathnerite template')
    manifest = load(ROOT / BSL / 'manifest.json')
    before_manifest = json.loads(git('show', BASE + ':' + BSL + '/manifest.json'))
    before_manifest['header']['version'] = [1, 0, 15]
    for module in before_manifest['modules']:
        module['version'] = [1, 0, 15]
    check(manifest == before_manifest, 'Manifest changed beyond version 1.0.15')
    for path in registrations:
        before = json.loads(git('show', BASE + ':' + rel(path)))
        for row in before:
            if row['pack_id'] == manifest['header']['uuid']:
                row['version'] = [1, 0, 15]
        check(load(path) == before, f'Other pack registration changed: {rel(path)}')

    allowed = set(provenance['files']) | {rel(p) for p in registrations}
    changed = git('diff', '--name-only', BASE).decode().splitlines()
    added = git('ls-files', '--others', '--exclude-standard').decode().splitlines()
    for name in set(changed + added):
        check(name in allowed or name.startswith('docs/bsl/') or name == 'tools/validate_bsl_phase05.py', f'Unexpected change: {name}')
    report = {
        'status': 'PASS' if not errors else 'FAIL', 'baseCommit': BASE,
        'lootTables': len(tables), 'strictJSON': len(tables) - len(jsonc), 'existingJSONC': jsonc,
        'bslLootTables': sum(n.startswith(BSL + '/') for n in tables), 'chestProfiles': len(chests),
        'nestedReferences': len(refs), 'references': refs, 'customItemCount': len(custom),
        'bslCustomItemCount': len(bsl_custom), 'bslCustomDefinitions': {i: definitions.get(i) for i in sorted(bsl_custom)},
        'dungeonDefinitionCount': len(dungeon_ids), 'errors': errors,
        'notes': ['Game engine acceptance, actual chest slots and stack merging are not tested.',
                  'Six unchanged Dungeon tables use comments and pass JSONC, not strict JSON.',
                  'Vanilla raider_drops.json verified at https://raw.githubusercontent.com/Mojang/bedrock-samples/main/behavior_pack/loot_tables/entities/raider_drops.json',
                  'BSL marker script still displays pre-existing 1.0.7; manifest is authoritative.',
                  'Unchanged BSL pots/trial_chambers/corridor.json contains heavy_core; outside the 36 chest tables and not reachable from them.'],
    }
    (DOC / 'validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({k: v for k, v in report.items() if k not in {'references', 'bslCustomDefinitions'}}, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
