"""Validate the release against the existing gameplay definitions and live asset links."""
from pathlib import Path
import json,subprocess,hashlib,struct
ROOT=Path(__file__).resolve().parents[2]
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def version(v):return tuple(map(int,v.split('.'))) if isinstance(v,str) else tuple(v)
release=read(ROOT/'docs/meshy_food/release.json');rows=read(ROOT/'docs/meshy_food/catalog.json')
bp=ROOT/release['packs']['bp'];rp=ROOT/release['packs']['rp']
git=['git','-c','safe.directory='+ROOT.as_posix()]
def original(rel):return subprocess.check_output(git+['show',release['base_commit']+':'+rel],cwd=ROOT)
def canonical(blob,suffix):
 if suffix=='.json':return json.loads(blob.decode('utf-8-sig'))
 return blob
for rel in release['protected_files']:
 p=ROOT/rel;assert canonical(p.read_bytes(),p.suffix)==canonical(original(rel),p.suffix),rel
atlas=read(rp/'textures/item_texture.json')['texture_data'];oldatlas=json.loads(original((rp/'textures/item_texture.json').relative_to(ROOT).as_posix()))['texture_data']
assert all(atlas[k]==v for k,v in oldatlas.items())
for p in (rp/'texts').glob('*.lang'):
 def entries(text):return dict(line.split('=',1) for line in text.splitlines() if '=' in line and not line.startswith('#'))
 old=entries(original(p.relative_to(ROOT).as_posix()).decode('utf-8-sig'));new=entries(p.read_text(encoding='utf-8-sig'));assert all(new[k]==v for k,v in old.items())
manifests={read(p)['header']['uuid']:read(p) for kind in ['behavior_packs','resource_packs'] for p in (ROOT/kind).glob('*/manifest.json')}
for m in manifests.values():
 assert all(version(mod['version'])==version(m['header']['version']) for mod in m['modules'])
 for d in m.get('dependencies',[]):
  if d.get('uuid') in manifests:assert version(d['version'])==version(manifests[d['uuid']]['header']['version'])
for p in [ROOT/'world_behavior_packs.json',ROOT/'world_resource_packs.json',*ROOT.glob('worlds/*/world_*_packs.json')]:
 before=json.loads(original(p.relative_to(ROOT).as_posix()));after=read(p);assert [r['pack_id'] for r in before]==[r['pack_id'] for r in after]
 for r in after:
  if r['pack_id'] in manifests:assert version(r['version'])==version(manifests[r['pack_id']]['header']['version'])
items={read(p)['minecraft:item']['description']['identifier'] for p in (bp/'items').glob('*.json')}
assert len(rows)==35 and len({r['name'] for r in rows})==35
triangles=0
for r in rows:
 name=r['name'];assert 'pine:'+name in items
 entity=read(bp/'entities/meshy_food'/(name+'.json'))['minecraft:entity'];client=read(rp/'entity/meshy_food'/(name+'.entity.json'))['minecraft:client_entity']['description']
 assert entity['description']['identifier']==client['identifier']==r['entity_id']
 assert entity['components']['minecraft:scale']['value']==1.65
 assert client['materials']['default']==r['material']
 geometry=read(rp/'models/entity/meshy_food'/(name+'.geo.json'))['minecraft:geometry'][0]
 assert geometry['description']['identifier']==client['geometry']['default']
 assert 'binding' not in geometry['bones'][0]
 assert len(geometry['bones'][0]['cubes'])==r['triangles'];triangles+=r['triangles']
 texture=rp/(client['textures']['default']+'.png');data=texture.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n'
 assert list(struct.unpack('>II',data[16:24]))==r['atlas_resolution']
 assert (rp/(atlas[name]['textures']+'.png')).is_file()
for p in rp.rglob('*.json'):
 obj=read(p)
 if 'minecraft:attachable' in obj:assert obj['minecraft:attachable']['description']['identifier'] not in items
for p in (bp/'functions/meshy_food').glob('*.mcfunction'):
 for line in p.read_text().splitlines():
  if line.startswith('give '):assert line.split()[2] in items
print(json.dumps({'result':'PASS','models':35,'source_triangles':triangles,'protected_gameplay_files':len(release['protected_files']),'scale':1.65,'runtime_test':'user accepted local behavior; server deployment tracked separately'}))
