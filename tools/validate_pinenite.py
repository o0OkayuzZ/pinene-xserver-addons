"""Validate integrated Pinenite assets. Requires Pillow; does not launch Minecraft.

Run from any directory: python tools/validate_pinenite.py
"""
from pathlib import Path
import base64
import collections
import hashlib
import json
import math
import subprocess

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / 'behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93'
RP = ROOT / 'resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b'
PARTS = dict(helmet='head', chestplate='chest', leggings='legs', boots='feet')
checks = []
preexisting_warnings = []


def check(label, condition):
    if not condition:
        raise AssertionError(label)
    checks.append(label)


def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def close(a, b):
    return len(a) == len(b) and all(abs(x - y) < 0.00003 for x, y in zip(a, b))


atlas = read(RP / 'textures/item_texture.json')['texture_data']
controllers = read(RP / 'render_controllers/pinenite.render_controllers.json')['render_controllers']
expected_bones = {
    'helmet': {'head': [0, 24, 0]},
    'chestplate': {'body': [0, 24, 0], 'rightArm': [-5, 22, 0], 'leftArm': [5, 22, 0]},
    'leggings': {'body': [0, 24, 0], 'rightLeg': [-1.9, 12, 0], 'leftLeg': [1.9, 12, 0]},
    'boots': {'rightLeg': [-1.9, 12, 0], 'leftLeg': [1.9, 12, 0]},
}
counts = {}
for part, slot in PARTS.items():
    identifier = f'true_dn:pinenite_{part}'
    item = read(BP / f'items/Deathnerite-Add-On/pinenite/armor/pinenite_{part}.json')['minecraft:item']
    comp = item['components']
    attach = read(RP / f'attachables/deathnerite/pinenite/pinenite_{part}.json')['minecraft:attachable']['description']
    geo = read(RP / f'models/entity/pinenite/{part}.geo.json')['minecraft:geometry'][0]
    check(part + ': identifiers agree', item['description']['identifier'] == attach['identifier'] == identifier)
    check(part + ': wearable slot, FINAL protection', comp['minecraft:wearable'] == {'slot': 'slot.armor.' + slot, 'protection': dict(helmet=8, chestplate=14, leggings=11, boots=8)[part]})
    inherited = read(BP / f'items/Deathnerite-Add-On/parcanite/armor/parcanite_{part}.json')['minecraft:item']['components']
    check(part + ': Parcanite traits inherited', all(comp.get(k) == v for k, v in inherited.items() if k not in {'minecraft:icon', 'minecraft:wearable'}))
    check(part + ': creative equipment, single stack', item['description']['menu_category']['category'] == 'equipment' and comp['minecraft:max_stack_size'] == 1)
    check(part + ': geometry reference resolves', geo['description']['identifier'] == attach['geometry']['default'])
    check(part + ': controller references resolve', all(c in controllers for c in attach['render_controllers']))
    check(part + ': original transparent material plus additive glow', attach['materials'] == {'default': 'entity_alphatest', 'glow': 'entity_emissive_alpha'} and 'animations' not in attach)
    for tex in attach['textures'].values():
        check(part + ': worn texture exists', (RP / (tex + '.png')).is_file())
    texture = Image.open(RP / (attach['textures']['default'] + '.png'))
    check(part + ': UV texture dimensions', texture.size == (geo['description']['texture_width'], geo['description']['texture_height']))
    key = comp['minecraft:icon']['textures']['default']
    check(part + ': independent icon path', atlas[key]['textures'] == f'textures/items/pinenite_{part}')
    icon = Image.open(RP / (atlas[key]['textures'] + '.png'))
    check(part + ': 32px RGBA icon with transparent background', icon.size == (32, 32) and icon.mode == 'RGBA' and set(icon.getchannel('A').tobytes()) == {0, 255} and all(icon.getpixel(p)[3] == 0 for p in [(0, 0), (31, 0), (0, 31), (31, 31)]))
    for lang in ['en_US', 'ja_JP']:
        text = (RP / f'texts/{lang}.lang').read_text(encoding='utf-8-sig')
        lookup = comp['minecraft:display_name']['value'] + '='
        matches = [line for line in text.splitlines() if line.startswith(lookup)]
        check(part + ': localized name ' + lang, len(matches) == 1 and '\ufffd' not in matches[0])
    bones = geo['bones']
    check(part + ': standard bones and pivots', {b['name']: b['pivot'] for b in bones} == expected_bones[part])
    check(part + ': unique bones', len({b['name'] for b in bones}) == len(bones))
    for b in bones:
        check(part + ': parent ' + b['name'], b.get('parent') == ('body' if b['name'] in ['leftArm', 'rightArm'] else None))
        for c in b.get('cubes', []):
            assert all(math.isfinite(v) for k in ['origin', 'size', 'pivot', 'rotation'] for v in c.get(k, []))
            assert all(v > 0 for v in c['size'])
            assert set(c['uv']) == {'north', 'south', 'east', 'west', 'up', 'down'}
            for uv in c['uv'].values():
                x, y = uv['uv']; w, h = uv['uv_size']
                assert w > 0 and h > 0 and 0 <= x < x + w <= texture.width and 0 <= y < y + h <= texture.height
    check(part + ': finite cube transforms and UVs in bounds', True)
    counts[part] = sum(len(b.get('cubes', [])) for b in bones)
    # Independently compare editable Blockbench elements, UVs, transforms and PNG.
    bb = read(ROOT / f'docs/pinenite/blockbench/pinenite_{part}.bbmodel')
    elements = {e['uuid']: e for e in bb['elements']}
    groups = {}
    def collect(g):
        groups[g['name']] = g
        for v in g['children']:
            if isinstance(v, dict):
                collect(v)
    for group in bb['outliner']:
        collect(group)
    check(part + ': editable model identifier', 'geometry.' + bb['model_identifier'] == geo['description']['identifier'])
    for b in bones:
        g = groups[b['name']]
        assert close(b['pivot'], [-g['origin'][0], *g['origin'][1:]])
        ids = [v for v in g['children'] if isinstance(v, str)]
        assert len(ids) == len(b.get('cubes', []))
        for c, eid in zip(b.get('cubes', []), ids):
            e = elements[eid]
            assert close(c['size'], [e['to'][i] - e['from'][i] for i in range(3)])
            assert close(c['origin'], [-e['to'][0], e['from'][1], e['from'][2]])
            assert close(c.get('rotation', [0, 0, 0]), [-e['rotation'][0], -e['rotation'][1], e['rotation'][2]])
            if 'pivot' in c:
                assert close(c['pivot'], [-e['origin'][0], *e['origin'][1:]])
            for face, uv in c['uv'].items():
                a = e['faces'][face]['uv']; pos = a[:2]; size = [a[2] - a[0], a[3] - a[1]]
                if face in ['up', 'down']:
                    pos = [pos[0] + size[0], pos[1] + size[1]]; size = [-size[0], -size[1]]
                assert close(pos, uv['uv']) and close(size, uv['uv_size'])
    embedded = base64.b64decode(bb['textures'][0]['source'].split(',', 1)[1])
    check(part + ': Blockbench geometry/UV/embedded PNG match runtime', embedded == (RP / (attach['textures']['default'] + '.png')).read_bytes())

check('205 cubes in upgraded silhouette', counts == dict(helmet=54, chestplate=100, leggings=27, boots=24))
check('first-person geometry hidden by dedicated controller', controllers['controller.render.true_dn.pinenite_armor']['part_visibility'] == [{'*': '!query.is_first_person'}])
fn = (BP / 'functions/pinenite/give_set.mcfunction').read_text()
check('function gives exactly four items to executor', [line for line in fn.splitlines() if line and not line.startswith('#')] == [f'give @s true_dn:pinenite_{part} 1' for part in PARTS])

# Look for collisions across the real set of loaded packs, not only our files.
for folder, kind in [('behavior_packs', 'items'), ('resource_packs', 'attachables')]:
    definitions = collections.Counter()
    for path in (ROOT / folder).glob(f'*/{kind}/**/*.json'):
        if 'pinenite_outline' in path.parts: continue  # Intentional top-priority visual overrides, tested separately.
        text = path.read_text(encoding='utf-8-sig')
        if 'true_dn:pinenite_' not in text:
            continue
        data = json.loads(text)
        key = 'minecraft:item' if kind == 'items' else 'minecraft:attachable'
        definitions[data[key]['description']['identifier']] += 1
    check(kind + ': no duplicate Pinenite identifiers', definitions == collections.Counter({f'true_dn:pinenite_{p}': 1 for p in PARTS}))
for folder in ['recipes', 'loot_tables']:
    hits = [p for p in (ROOT / 'behavior_packs').glob(f'*/{folder}/**/*') if p.is_file() and b'true_dn:pinenite_' in p.read_bytes()]
    check('no Pinenite integration in ' + folder, not hits)

manifests = [read(p) for p in ROOT.glob('*_packs/*/manifest.json')]
headers = {m['header']['uuid']: m['header']['version'] for m in manifests}
check('35 original packs plus dedicated Pinenite outline RP', len(headers) == len(manifests) == 36)
for m in manifests:
    check('module versions ' + m['header']['uuid'], all(mod['version'] == m['header']['version'] for mod in m['modules']))
    for dep in m.get('dependencies', []):
        # Some pre-existing dependencies use an alias UUID not present as a header.
        if dep.get('uuid') in headers:
            check('dependency ' + dep['uuid'], headers[dep['uuid']] == dep['version'])
for path in ROOT.glob('world_*_packs.json'):
    data = read(path)
    owned = {read(BP / 'manifest.json')['header']['uuid'], read(RP / 'manifest.json')['header']['uuid'], '2c5e0de8-0360-49ac-bfe5-339a2a0e62f2', 'c91096f3-71a0-4e44-9fa6-c9e359017ac7', 'ef6e99cf-077d-4b55-9e11-f86bb9e66880', 'b29dadb1-6c0e-42f6-a56e-f52e01dff8e9'}
    for entry in data:
        if headers.get(entry['pack_id']) != entry['version']:
            preexisting_warnings.append({'file': path.name, 'pack_id': entry['pack_id'], 'registered': entry['version'], 'manifest': headers.get(entry['pack_id'])})
    main_registration = json.loads(subprocess.check_output(['git', 'show', '559feb4d:' + path.name], cwd=ROOT))
    for entry in main_registration:
        if entry['pack_id'] in owned: entry['version'] = headers[entry['pack_id']]
    check('other registrations preserved from main ' + path.name, data == main_registration)
    for copy in ROOT.glob('worlds/*/' + path.name):
        original_copy = json.loads(subprocess.check_output(['git', 'show', '559feb4d:' + copy.relative_to(ROOT).as_posix()], cwd=ROOT))
        for entry in original_copy:
            if entry['pack_id'] in owned: entry['version'] = headers[entry['pack_id']]
        check('world registration preserved from main ' + copy.as_posix(), read(copy) == original_copy)

# Verify preservation against the clean checkout recorded at integration time.
source = read(ROOT / 'docs/pinenite/source.json')
git = ['git', '-c', 'safe.directory=' + ROOT.as_posix()]
baseline = 'cd53e576'
def original(path):
    return subprocess.check_output(git + ['show', baseline + ':' + path.relative_to(ROOT).as_posix()], cwd=ROOT)

old_atlas = json.loads(original(RP / 'textures/item_texture.json'))
new_atlas = read(RP / 'textures/item_texture.json')
check('all pre-existing atlas entries preserved', new_atlas == old_atlas)
check('existing Japanese localization bytes preserved', (RP / 'texts/ja_JP.lang').read_bytes().startswith(original(RP / 'texts/ja_JP.lang')))
changed_tracked = subprocess.check_output(git + ['diff', '--name-only', '--diff-filter=MDRT', baseline], cwd=ROOT, text=True, encoding='utf-8').splitlines()
allowed = {
    'package.json', 'tools/validate_pinenite.py',
    (BP / 'manifest.json').relative_to(ROOT).as_posix(),
    (BP / 'scripts/main.js').relative_to(ROOT).as_posix(),
    (RP / 'manifest.json').relative_to(ROOT).as_posix(),
    'behavior_packs/bp_08_2c5e0de8-0360-49ac-bfe5-339a2a0e62f2/manifest.json',
    'world_behavior_packs.json', 'world_resource_packs.json',
    'worlds/Bedrock level/world_behavior_packs.json', 'worlds/Bedrock level/world_resource_packs.json',
    (RP / 'render_controllers/pinenite.render_controllers.json').relative_to(ROOT).as_posix(),
} | {(BP / f'items/Deathnerite-Add-On/pinenite/armor/pinenite_{part}.json').relative_to(ROOT).as_posix() for part in PARTS} | {
    (RP / f'attachables/deathnerite/pinenite/pinenite_{part}.json').relative_to(ROOT).as_posix() for part in PARTS}
allowed |= {'tests/pinenite/assets.test.mjs', 'tests/pinenite/runtime.test.mjs', 'tools/apply_addon_release.py', 'docs/pinenite/combat_validation.json', (BP / 'scripts/pinenite/main.js').relative_to(ROOT).as_posix()}
# Exact compatibility fixes for errors captured on 2026-09-14.
allowed |= {'tools/pinenite/build_combat_assets.py', 'tools/pinenite/build_outline_assets.py',
            'tools/pinecd/build.py', 'tests/pinenite/outline.test.mjs',
            'docs/pinenite/outline_coverage.json',
            (RP / 'animations/pinenite_sync.animation.json').relative_to(ROOT).as_posix()}
for prefix, paths in {
    'behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/': ['manifest.json', 'scripts/golden_foods/main.js'],
    'behavior_packs/bp_04_b29dadb1-6c0e-42f6-a56e-f52e01dff8e9/': ['manifest.json'] + [f'items/compat_pinecd_cd_{i:02}.item.json' for i in range(1, 20)],
    'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/': ['scripts/main.js', 'recipes/blue_diamond_apple.recipe.json', 'recipes/enchanted_blue_diamond_apple.recipe.json'] + ['recipes/onso/' + n + '.recipe.json' for n in ['onso_from_all_cds_any_mix_shapeless', 'onso_from_all_cds_shaped', 'onso_from_all_cds_tag']],
    RP.relative_to(ROOT).as_posix() + '/attachables/ranged/': [n + '.json' for n in ['crossbow_harp', 'crossbow_harp_lightning', 'crossbow_scatter', 'dualcrossbow', 'dualcrossbow_baby', 'dualcrossbow_spellbound']],
}.items():
    allowed.update(prefix + p for p in paths)
check('only documented existing files changed', all(p in allowed or p.startswith('resource_packs/pinenite_outline/') for p in changed_tracked))
check('existing geometry and all textures unchanged', not any(('/models/' in p or p.endswith('.png')) and not p.startswith('resource_packs/pinenite_outline/') for p in changed_tracked))

report = {'static_validation': 'passed', 'check_count': len(checks), 'checks': checks,
          'preexisting_registration_warnings': preexisting_warnings,
          'cube_counts': counts, 'total_cubes': sum(counts.values()),
          'minecraft_import_tested': False, 'minecraft_wear_and_animation_tested': False,
          'content_log_tested': False, 'server_deployed': False}
(ROOT / 'docs/pinenite/combat_validation.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k != 'checks'}, indent=2))
