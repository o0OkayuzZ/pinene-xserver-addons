"""Run from any directory. Optional --baseline points at the pre-change backup."""
from pathlib import Path
import argparse
import json
import struct

ROOT = Path(__file__).resolve().parents[2]
BP = ROOT / 'behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1'
RP = ROOT / 'resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10'
parser = argparse.ArgumentParser()
parser.add_argument('--baseline', type=Path)
args = parser.parse_args()
load = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
parsed = 0
for pack in (BP, RP):
    for file in pack.rglob('*.json'):
        load(file)
        parsed += 1

atlas = load(RP / 'textures/item_texture.json')['texture_data']
controller = load(RP / 'render_controllers/zombiegear_v4hd.render_controllers.json')['render_controllers']
assert controller['controller.render.zombiegear.organic_v4hd']['part_visibility'] == [{'*': '!query.is_first_person'}]
geometries = {}
for file in (RP / 'models').rglob('*.json'):
    for geometry in load(file).get('minecraft:geometry', []):
        identifier = geometry['description']['identifier']
        if identifier.startswith('geometry.zombiegear.v4hd_'):
            assert identifier not in geometries, identifier
            geometries[identifier] = geometry
counts = {}
identifiers = set()
for part, protection in [('helmet', 2), ('chestplate', 6), ('leggings', 5), ('boots', 2)]:
    for stage in range(5):
        key = f'zombie_{part}' + (f'_c{stage}' if stage else '')
        item_file = BP / 'items' / f'{key}.item.json'
        item = load(item_file)['minecraft:item']
        identifier = item['description']['identifier']
        assert identifier == f'zombiegear:{key}' and identifier not in identifiers
        identifiers.add(identifier)
        components = item['components']
        assert components['minecraft:wearable']['protection'] == protection
        assert components['minecraft:icon'] == key
        attach = load(RP / 'attachables' / f'{key}.json')['minecraft:attachable']['description']
        assert attach['identifier'] == identifier
        assert all(rc in controller for rc in attach['render_controllers'])
        geometry = geometries[attach['geometry']['default']]
        names = {b['name'] for b in geometry['bones']}
        assert len(names) == len(geometry['bones'])
        for bone in geometry['bones']:
            assert 'parent' not in bone or bone['parent'] in names
            for cube in bone.get('cubes', []):
                assert all(size >= 0 for size in cube['size'])
        counts[key] = sum(len(b.get('cubes', [])) for b in geometry['bones'])
        texture = RP / (attach['textures']['default'] + '.png')
        header = texture.read_bytes()[:24]
        assert header[:8] == b'\x89PNG\r\n\x1a\n'
        width, height = struct.unpack('>II', header[16:24])
        assert (width, height) == (geometry['description']['texture_width'], geometry['description']['texture_height'])
        assert (RP / (atlas[key]['textures'] + '.png')).is_file()
        if args.baseline:
            old = load(args.baseline / item_file.relative_to(ROOT))['minecraft:item']
            expected = json.loads(json.dumps(old))
            expected['components']['minecraft:wearable']['protection'] = protection
            assert item == expected, f'unexpected item change: {key}'
    assert all(counts[f'zombie_{part}' + (f'_c{n}' if n else '')] <= counts[f'zombie_{part}_c{n+1}'] for n in range(4))

for pack, kind in [(BP, 'behavior'), (RP, 'resource')]:
    manifest = load(pack / 'manifest.json')
    header = manifest['header']
    assert all(m['version'] == header['version'] for m in manifest['modules'])
    for prefix in ['', 'worlds/Bedrock level/']:
        records = load(ROOT / f'{prefix}world_{kind}_packs.json')
        assert next(x for x in records if x['pack_id'] == header['uuid'])['version'] == header['version']
    if args.baseline:
        old = load(args.baseline / (pack / 'manifest.json').relative_to(ROOT))
        assert header['uuid'] == old['header']['uuid']
        assert [x['uuid'] for x in manifest['modules']] == [x['uuid'] for x in old['modules']]
        assert [(x.get('uuid'), x.get('module_name')) for x in manifest['dependencies']] == [(x.get('uuid'), x.get('module_name')) for x in old['dependencies']]

if args.baseline:
    old_atlas = load(args.baseline / (RP / 'textures/item_texture.json').relative_to(ROOT))['texture_data']
    assert atlas.keys() == old_atlas.keys()
    for key in atlas:
        if f'zombiegear:{key}' not in identifiers:
            assert atlas[key] == old_atlas[key], key
    protected = 0
    for old in args.baseline.rglob('*'):
        if not old.is_file():
            continue
        rel = old.relative_to(args.baseline)
        if rel.parts[0] not in ('behavior_packs', 'resource_packs'):
            continue
        if old.name == 'manifest.json' or rel.as_posix().endswith('textures/item_texture.json') or \
                (old.name.startswith('zombie_') and ('items' in rel.parts or 'attachables' in rel.parts)) or old.name == 'main.js':
            continue
        assert (ROOT / rel).read_bytes() == old.read_bytes(), f'unrelated pack file changed: {rel}'
        protected += 1
    print(f'PASS {protected} protected existing files unchanged (includes recipes, language and crossbow assets)')

print(f'PASS {parsed} JSON files, 20 item IDs/protections/icons, 20 geometries/textures, first-person visibility, UUIDs and registration versions')
for stage in range(5):
    suffix = f'_c{stage}' if stage else ''
    cubes = sum(counts[f'zombie_{part}{suffix}'] for part in ('helmet','chestplate','leggings','boots'))
    print(f'c{stage}: {cubes} cubes/set; 4 wearers: {cubes*4}; 8 wearers: {cubes*8} (counts, not FPS measurements)')
