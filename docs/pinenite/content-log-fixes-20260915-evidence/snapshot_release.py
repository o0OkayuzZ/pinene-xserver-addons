from pathlib import Path
import base64, json, subprocess, re
R=Path('C:/work/pinene-ic-reliability'); W=Path(__file__).parent
def parse(b):
 s=b.decode('utf-8-sig');s=re.sub(r'("(?:\\.|[^"\\])*"\s*)|//[^\n]*|/\*[\s\S]*?\*/',lambda m:m[1] or '',s)
 return json.loads(re.sub(r',\s*([}\]])',r'\1',s))
def enc(d):return (json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode()
def git(*args):return subprocess.check_output(['git','-c','core.safecrlf=false',*args],cwd=R,text=True).splitlines()
names=set(git('diff','--name-only','HEAD')+git('ls-files','--others','--exclude-standard'))
game={n for n in names if n.startswith(('behavior_packs/','resource_packs/')) and '/tests/' not in n}
rp=R/'resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a'
extra={p.relative_to(R).as_posix() for p in rp.rglob('*') if p.is_file() and any(s in p.as_posix().lower() for s in ['myco','mushroom_appraiser'])}
extra.add((rp/'textures/item_texture.json').relative_to(R).as_posix())
(W/'extra-files.json').write_bytes(enc(sorted(extra)));game.update(extra)
manifests={p.parent.relative_to(R).as_posix():parse(p.read_bytes()) for k in ['behavior_packs','resource_packs'] for p in (R/k).glob('*/manifest.json')}
paths=game|{p+'/manifest.json' for p in manifests}
paths.update(prefix+'world_'+k+'.json' for prefix in ['', 'worlds/Bedrock level/'] for k in ['behavior_packs','resource_packs'])
script="""from pathlib import Path
import base64,json
r=Path('/opt/minecraft/server')
paths=set(REQUEST)
for kind in ['behavior_packs','resource_packs']:
 paths.update(p.relative_to(r).as_posix() for p in (r/kind).glob('*/manifest.json'))
print(json.dumps({p:base64.b64encode((r/p).read_bytes()).decode() if (r/p).is_file() else None for p in paths}))
""".replace('REQUEST',repr(sorted(paths)))
ssh=['C:/Windows/System32/OpenSSH/ssh.exe','-i',str(Path.home()/'.ssh/pinene_xserver_ed25519'),'-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','ConnectTimeout=10','root@x220-158-24-174.static.xvps.ne.jp']
raw=subprocess.check_output(ssh+['python3 -'],input=script.encode());(W/'server-before.json').write_bytes(raw)
remote=json.loads(raw); observed={}
for p,b in remote.items():
 if p.endswith('/manifest.json') and b:
  try:d=parse(base64.b64decode(b));observed.setdefault(d['header']['uuid'],[]).append(d['header']['version'])
  except Exception:pass
worlds=Path.home()/'AppData/Roaming/Minecraft Bedrock/Users/10345784260749742919/games/com.mojang/minecraftWorlds'
for name in ['8v9pvwiD6QQ=','IC_Phase1_Fresh_20260911','Aurealis_Pinene_Full_Test_20260830']:
 for kind in ['behavior_packs','resource_packs']:
  for p in (worlds/name/kind).glob('*/manifest.json'):
   try:d=parse(p.read_bytes());observed.setdefault(d['header']['uuid'],[]).append(d['header']['version'])
   except Exception:pass
touched={manifests['/'.join(p.split('/')[:2])]['header']['uuid'] for p in game}
while True:
 new={d['header']['uuid'] for d in manifests.values() if any(x.get('uuid') in touched for x in d.get('dependencies',[]))}
 if new<=touched:break
 touched.update(new)
versions={}
for prefix,d in manifests.items():
 u=d['header']['uuid']
 if u in touched:
  v=list(max([d['header']['version']]+observed.get(u,[])));v[-1]+=1;versions[u]=v
for prefix,d in manifests.items():
 u=d['header']['uuid']
 if u not in versions:continue
 d['header']['version']=versions[u]
 for m in d['modules']:m['version']=versions[u]
 for dep in d.get('dependencies',[]):
  if dep.get('uuid') in versions:dep['version']=versions[dep['uuid']]
 (R/prefix/'manifest.json').write_bytes(enc(d))
(W/'versions.json').write_bytes(enc(versions))
print(json.dumps({'snapshotFiles':len(remote),'extraAssets':len(extra),'versions':versions}))
