import json,hashlib,datetime
from pathlib import Path
R=Path(__file__).resolve().parents[1];D=R/'docs/golden_foods'
W=Path.home()/'AppData/Roaming/Minecraft Bedrock/Users/10345784260749742919/games/com.mojang/minecraftWorlds'
roots=[R,W/'Aurealis_Pinene_Full_Test_20260830',W/'8v9pvwiD6QQ=']
ops={}
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def enc(v):return (json.dumps(v,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def sha(b):return hashlib.sha256(b).hexdigest()
for root in roots:
 manifests={read(p)['header']['uuid']:(p,read(p)) for kind in ['behavior_packs','resource_packs'] for p in (root/kind).glob('*/manifest.json')}
 targets=[(u,p,m) for u,(p,m) in manifests.items() if (p.parent/'textures/pinene_golden_foods/guide.png').exists()]
 assert len(targets)==1
 u,rp,m=targets[0]
 for f in (D/'refined_textures').glob('*.png'):
  dest=rp.parent/'textures/pinene_golden_foods'/f.name
  if dest.read_bytes()!=f.read_bytes():ops[dest]=f.read_bytes()
 changed={u}
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
prov=read(D/'texture_provenance.json');validation=read(D/'refined_texture_validation.json')
for n,v in prov['assets'].items():
 v['output_sha256']=validation['assets'][n]['output_sha256']
 if v.get('mode')!='native':v['mode']=validation['method']+('; neutral page pixels retained' if n=='guide' else '; existing green regions retained')
ops[D/'texture_provenance.json']=enc(prov)
stamp=datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f');backup=Path.home()/'Downloads/pinene-gf-backups'/('gold_palette_refinement_'+stamp);backup.mkdir(parents=True)
records=[]
for path,b in ops.items():
 assert any(path.resolve().is_relative_to(root.resolve()) for root in roots)
 root=next(r for r in roots if path.is_relative_to(r));rel=Path(str(roots.index(root)))/path.relative_to(root)
 old=path.read_bytes();q=backup/rel;q.parent.mkdir(parents=True,exist_ok=True);q.write_bytes(old)
 records.append({'path':str(path),'backup':str(q),'before':sha(old),'after':sha(b)})
(backup/'rollback_manifest.json').write_bytes(enc(records))
try:
 for path,b in ops.items():path.write_bytes(b)
 for path,b in ops.items():assert path.read_bytes()==b
except Exception:
 for record in records:Path(record['path']).write_bytes(Path(record['backup']).read_bytes())
 raise
report={'state':'APPLIED','worlds':[str(r) for r in roots[1:]],'backup':str(backup),'files':len(ops),'checks':'Gold palette, dimensions, alpha, native images, dependency versions, registration versions, deployed bytes PASS','in_game_verified':False}
(D/'GOLD_REFINEMENT_DEPLOYMENT.json').write_bytes(enc(report));print(json.dumps(report,ensure_ascii=True,indent=2))
