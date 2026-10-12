"""Check pack identities, referenced assets, geometry bounds and archive contents."""
from pathlib import Path
import json
import zipfile
import uuid
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
BP, RP = ROOT / 'BP', ROOT / 'RP'

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

for path in [*BP.rglob('*.json'), *RP.rglob('*.json')]:
    load(path)
bm, rm = load(BP / 'manifest.json'), load(RP / 'manifest.json')
ids = [m['header']['uuid'] for m in [bm, rm]] + [entry['uuid'] for m in [bm, rm] for entry in m['modules']]
assert len(ids) == len(set(ids))
for identifier in ids:
    uuid.UUID(identifier)
assert bm['dependencies'][0] == {'uuid': rm['header']['uuid'], 'version': rm['header']['version']}
assert (BP / next(entry['entry'] for entry in bm['modules'] if entry['type'] == 'script')).is_file()
identifiers = {load(path)['minecraft:entity']['description']['identifier'] for path in (BP / 'entities').glob('*.json')}
assert identifiers == {'pinene_sans:sans', 'pinene_sans:bone', 'pinene_sans:blaster'}
geometries = {}
for path in (RP / 'models/entity').glob('*.json'):
    geometry = load(path)['minecraft:geometry'][0]
    desc = geometry['description']
    geometries[desc['identifier']] = path
    bones = {bone['name'] for bone in geometry['bones']}
    for bone in geometry['bones']:
        assert not bone.get('parent') or bone['parent'] in bones
        for cube in bone.get('cubes', []):
            assert all(size > 0 for size in cube['size'])
            for face in cube['uv'].values():
                assert face['uv'][0] >= 0 and face['uv'][1] >= 0
                assert face['uv'][0] + face['uv_size'][0] <= desc['texture_width']
                assert face['uv'][1] + face['uv_size'][1] <= desc['texture_height']
animations = load(RP / 'animations/sans.animation.json')['animations']
for path in (RP / 'entity').glob('*.json'):
    desc = load(path)['minecraft:client_entity']['description']
    assert desc['identifier'] in identifiers
    for geo in desc['geometry'].values(): assert geo in geometries
    for texture in desc['textures'].values():
        assert (RP / (texture + '.png')).is_file() or (RP / (texture + '.tga')).is_file()
    for animation in desc.get('animations', {}).values(): assert animation in animations
for path in (RP / 'particles').glob('*.json'):
    texture = load(path)['particle_effect']['description']['basic_render_parameters']['texture']
    assert (RP / (texture + '.png')).is_file()
assert Image.open(RP / 'textures/entity/sans_atlas.png').size == (256, 128)
assert Image.open(RP / 'textures/entity/sans_atlas_mer.png').size == (256, 128)
render_atlas = Image.open(RP / 'textures/entity/sans_atlas_render.tga')
assert render_atlas.size == (256, 128)
assert render_atlas.getpixel((5*16+8,8))[3] == 32
assert render_atlas.getpixel((8,8))[3] == 255
budget = {'sans':600, 'blaster':250, 'bone':12}
for name, maximum in budget.items():
    g=load(RP / f'models/entity/{name}.geo.json')['minecraft:geometry'][0]
    assert sum(len(b.get('cubes',[])) for b in g['bones']) <= maximum
    if name == 'sans':
        assert {b['name'] for b in g['bones']} >= {'magic_eye','pupil','hood','left_arm','right_arm'}
assert 'pinene_sans:casting' in load(BP/'entities/sans.json')['minecraft:entity']['description']['properties']
assert load(RP / 'manifest.json')['capabilities'] == ['pbr']
for locale in ['en_US', 'ja_JP']:
    assert 'entity.pinene_sans:sans.name=' in (RP / f'texts/{locale}.lang').read_text(encoding='utf-8')
archive = ROOT / ('dist/Pinene_Sans_Boss_v' + '.'.join(map(str,bm['header']['version'])) + '.mcaddon')
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    for pack in [BP, RP]:
        for path in pack.rglob('*'):
            if path.is_file():
                rel = f'Pinene_Sans_{pack.name}/{path.relative_to(pack).as_posix()}'
                assert bundle.read(rel) == path.read_bytes(), f'Archive stale: {rel}'
print(json.dumps({'status': 'passed', 'entities': len(identifiers), 'geometries': len(geometries),
                  'package_bytes': archive.stat().st_size, 'engine_tested': False}))
