import json,hashlib,datetime
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'docs/golden_foods'
W=Path.home()/'AppData/Roaming/Minecraft Bedrock/Users/10345784260749742919/games/com.mojang/minecraftWorlds'
roots=[R,W/'Aurealis_Pinene_Full_Test_20260830',W/'8v9pvwiD6QQ=']
ops={}
S=R/'docs/golden_extensions/stage'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def enc(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def sha(b):return hashlib.sha256(b).hexdigest()
for root in roots:
 manifests={read(p)['header']['uuid']:(p,read(p)) for kind in ['behavior_packs','resource_packs'] for p in (root/kind).glob('*/manifest.json')}
 targets=[(u,p,m) for u,(p,m) in manifests.items() if (p.parent/'textures/pinene_golden_foods/guide.png').exists()]
 assert len(targets)==1
 u,rp,m=targets[0]
 bp_candidates=[(k,p,m) for k,(p,m) in manifests.items() if (p.parent/'scripts/golden_foods/main.js').exists()]
 assert len(bp_candidates)==1
 bu,bp,bm=bp_candidates[0]
 for section,pack in [('bp',bp.parent),('rp',rp.parent)]:
  for f in (S/section).rglob('*'):
   if f.is_file():ops[pack/f.relative_to(S/section)]=f.read_bytes()
 atlas_path=rp.parent/'textures/item_texture.json';atlas=read(atlas_path)
 for tex in ['golden_egg','golden_chorus_fruit']:atlas['texture_data']['pinene_golden_foods_'+tex]={'textures':'textures/pinene_golden_foods/'+tex}
 ops[atlas_path]=enc(atlas)
 changed={u,bu}
 while True:
  more={k for k,(_,m) in manifests.items() if any(d.get('uuid') in changed for d in m.get('dependencies',[]))}
  if more<=changed:break
  changed|=more
 versions={}
 for k in changed:
  m=manifests[k][1];v=m['header']['version'][:];v[-1]+=1;versions[k]=v
 for k in changed:
  path,m=manifests[k];m['header']['version']=versions[k]
  for module in m['modules']:module['version']=versions[k]
  for d in m.get('dependencies',[]):
   if d.get('uuid') in versions:d['version']=versions[d['uuid']]
  ops[path]=enc(m)
 for path in [root/'world_behavior_packs.json',root/'world_resource_packs.json']+list((root/'worlds').glob('*/world_*_packs.json')):
  if not path.exists():continue
  entries=read(path);dirty=False
  for e in entries:
   if e['pack_id'] in versions:e['version']=versions[e['pack_id']];dirty=True
  if dirty:ops[path]=enc(entries)
 # Verify all changed UUID dependencies and active registration versions in memory.
 for k in changed:
  m=manifests[k][1]
  for d in m.get('dependencies',[]):
   if d.get('uuid') in versions:assert d['version']==versions[d['uuid']]
 for kind in ['behavior_packs','resource_packs']:
  path=root/f'world_{kind}.json'
  for e in json.loads(ops.get(path,path.read_bytes())):
   if e['pack_id'] in versions:assert e['version']==versions[e['pack_id']]
# Reject new-ID collisions and preserve unrelated files in each existing pack.
new_ids={'a:gegg','a:egegg','a:gchorus_fruit','a:egchorus_fruit','pinene:golden_egg_projectile','pinene:enchanted_golden_egg_projectile'}
for root in roots:
 for kind in ['items','entities']:
  for p in (root/'behavior_packs').glob('*/'+kind+'/**/*.json'):
   try:
    d=read(p);identifier=next((v.get('description',{}).get('identifier') for v in d.values() if isinstance(v,dict) and 'description' in v),None)
   except (ValueError,UnicodeError):continue
   assert identifier not in new_ids, ('Existing ID collision; inspect instead of overwriting',str(p),identifier)
 # The two shared entry files must still match the reviewed source before patching.
 if root!=R:
  for path in ops:
   if path.is_relative_to(root) and path.name in ['main.js','guide.js'] and path.parent.name=='golden_foods':
    expected=R/'behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods'/path.name
    assert path.read_bytes()==expected.read_bytes(), ('Concurrent script change',str(path))
protected={}
for root in roots:
 for kind in ['behavior_packs','resource_packs']:
  for p in (root/kind).rglob('*'):
   if p.is_file() and p not in ops:protected[p]=sha(p.read_bytes())
stamp=datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f');backup=Path.home()/'Downloads/pinene-gf-backups'/('gold_egg_chorus_'+stamp);backup.mkdir(parents=True)
records=[]
for path,b in ops.items():
 assert any(path.resolve().is_relative_to(root.resolve()) for root in roots)
 root=next(r for r in roots if path.is_relative_to(r));rel=Path(str(roots.index(root)))/path.relative_to(root)
 old=path.read_bytes() if path.exists() else None;q=backup/rel;q.parent.mkdir(parents=True,exist_ok=True)
 if old is not None:q.write_bytes(old)
 records.append({'path':str(path),'backup':str(q),'before':sha(old) if old is not None else None,'after':sha(b)})
(backup/'rollback_manifest.json').write_bytes(enc(records))
try:
 for path,b in ops.items():path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b)
 for path,b in ops.items():assert path.read_bytes()==b
 for path,digest in protected.items():assert sha(path.read_bytes())==digest,('Unrelated file changed',str(path))
except Exception:
 for record in records:
  path=Path(record['path'])
  if record['before'] is not None:path.write_bytes(Path(record['backup']).read_bytes())
  elif path.exists():path.unlink()
 raise
report={'state':'APPLIED','worlds':[str(r) for r in roots[1:]],'backup':str(backup),'files':len(ops),'checks':'Dependency versions, registration versions, deployed bytes PASS','in_game_verified':False,'unchanged_files_verified':len(protected),'operations':records}
(R/'docs/golden_extensions/DEPLOYMENT.json').write_bytes(enc(report));print(json.dumps({k:v for k,v in report.items() if k!='operations'},ensure_ascii=True,indent=2))
