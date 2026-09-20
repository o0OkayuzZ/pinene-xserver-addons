"""Verify release NF-001..100 against approved archives and integrated BP/RP."""
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
DOWNLOADS = Path.home() / 'Downloads'
BP = REPO / 'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639'
RP = REPO / 'resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a'

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

with zipfile.ZipFile(DOWNLOADS / 'NF_001-020_CODEX_LITE.zip') as z:
    official = json.loads(z.read('nf001_020_lite/formal/nether_fungi_master_v1.0.json'))
assert load(ROOT / 'data/nether_fungi_master_v1.0.json') == official
atlas = load(RP / 'textures/item_texture.json')['texture_data']
langs = {locale:dict(line.split('=', 1) for line in (RP / f'texts/{locale}.lang').read_text(encoding='utf8').splitlines() if '=' in line and not line.startswith('#')) for locale in ['ja_JP', 'en_US']}
items = [load(p)['minecraft:item']['description']['identifier'] for p in BP.rglob('items/**/*.json')]
records = []
with zipfile.ZipFile(DOWNLOADS / 'NF_001-020_TEXTURE_FINAL_v4.zip') as early, zipfile.ZipFile(DOWNLOADS / 'NF_FINAL_HANDOFF_PACKAGE(1).zip') as final:
    for e in official['entries']:
        number = e['number']; slug = f'nf_{number:03d}'
        archive = early if number <= 20 else final
        candidates = [n for n in archive.namelist() if n.endswith('/' + slug + '.png') and '/textures/' in n] if number <= 20 else [f'FINAL_PNGS/NF-{number:03d}.png']
        assert len(candidates) == 1
        raw = archive.read(candidates[0])
        for path in [ROOT / f'reference/nether_fungi/{slug}.png', ROOT / f'pack/RP/textures/items/mycology/nf/{slug}.png', RP / f'textures/items/mycology/nf/{slug}.png']:
            assert path.read_bytes() == raw, path
        item = load(BP / f'items/mycology/nf/{slug}.json')['minecraft:item']
        assert items.count(f'pinene:{slug}') == 1
        assert item['description']['identifier'] == f'pinene:{slug}'
        c = item['components']
        assert set(c) == {'minecraft:display_name', 'minecraft:icon', 'minecraft:max_stack_size'}
        assert c['minecraft:icon']['textures']['default'] == f'pinene_myco_{slug}'
        assert atlas[f'pinene_myco_{slug}']['textures'] == f'textures/items/mycology/nf/{slug}'
        for lang in langs.values():
            assert lang[c['minecraft:display_name']['value']] == e['display_name']
        records.append({'id':e['id'], 'name':e['display_name'], 'family':e['family'], 'archive':Path(archive.filename).name, 'member':candidates[0], 'sha256':hashlib.sha256(raw).hexdigest()})
for source in (ROOT / 'pack/BP/scripts/mycology').glob('*.js'):
    assert source.read_bytes() == (BP / 'scripts/mycology' / source.name).read_bytes()
guide = load(REPO / 'behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/items/golden_food_guide.json')
assert guide['minecraft:item']['components']['minecraft:glint'] is True
(ROOT / 'docs/NF_SOURCE_AUDIT.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n', encoding='utf8')
print('PASS: 100 formal mappings, 300 exact PNG copies, integrated items/atlas/locales/scripts, golden guide glint')
