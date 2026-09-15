from pathlib import Path
import base64, datetime, hashlib, json, re, subprocess

REPO=Path('C:/work/pinene-ic-reliability')
WORK=Path(__file__).parent
HOME=Path.home()
SHARED=HOME/'AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang'
WORLDS=HOME/'AppData/Roaming/Minecraft Bedrock/Users/10345784260749742919/games/com.mojang/minecraftWorlds'
def parse(b):
    s=b.decode('utf-8-sig')
    s=re.sub(r'("(?:\\.|[^"\\])*"\s*)|//[^\n]*|/\*[\s\S]*?\*/',lambda m:m[1] or '',s)
    return json.loads(re.sub(r',\s*([}\]])',r'\1',s))
def enc(d):return (json.dumps(d,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def sha(b):return hashlib.sha256(b).hexdigest() if b is not None else None
def read(p):return p.read_bytes() if p.is_file() else None
def git(*args):return subprocess.check_output(['git','-c','core.safecrlf=false',*args],cwd=REPO,text=True).splitlines()
versions=json.loads((WORK/'versions.json').read_text())
names=set(git('diff','--name-only','HEAD')+git('ls-files','--others','--exclude-standard'))
game={n:read(REPO/n) for n in names if n.startswith(('behavior_packs/','resource_packs/')) and '/tests/' not in n}
game.update({n:read(REPO/n) for n in json.loads((WORK/'extra-files.json').read_text())})

def content(rel, old, desired):
    if old is None or desired is None:return desired
    if rel.endswith('/textures/item_texture.json'):
        d=parse(old);src=parse(desired)
        d.setdefault('texture_data',{}).update({k:v for k,v in src['texture_data'].items() if k.startswith('pinene_myco_')})
        return old if d==parse(old) else enc(d)
    if '/color_grading/' in rel:
        d=parse(old);c=d['minecraft:color_grading_settings']['color_grading']
        c.get('midtones',{}).pop('midtonesMax',None)
        h=c.get('highlights',{})
        if 'highlightsMin' in h:h['highlightsMin']=min(20,max(1,h['highlightsMin']))
        return old if d==parse(old) else enc(d)
    if rel.endswith('/blocks.json'):
        d=parse(old);d['pinene_pvp:dragon_relic_block'].pop('textures',None)
        return old if d==parse(old) else enc(d)
    if rel.endswith('.json') and parse(old)==parse(desired):return old
    return desired
source_manifests={}
for kind in ['behavior_packs','resource_packs']:
    for p in (REPO/kind).glob('*/manifest.json'):
        d=parse(p.read_bytes());source_manifests[p.parent.relative_to(REPO).as_posix()]=d

def metadata(old, version_map):
    d=parse(old);u=d['header']['uuid']
    if u in version_map:
        d['header']['version']=version_map[u]
        for mod in d['modules']:mod['version']=version_map[u]
    for dep in d.get('dependencies',[]):
        if dep.get('uuid') in version_map:dep['version']=version_map[dep['uuid']]
    return enc(d)

def plan(label,root,existing,ops,server=False,world=None):
    # Only changed bytes become mutations; preserve every unrelated file.
    ops={p:b for p,b in ops.items() if b!=existing.get(p)}
    stamp=datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
    backup=('/opt/minecraft/server/_pinene_deploy_backups/ic_reliability_'+stamp if server else str(WORK/'backups'/(label+'_'+stamp)))
    rows={p:{'before':sha(existing.get(p)),'after':sha(b),'data':base64.b64encode(b).decode() if b is not None else None} for p,b in ops.items()}
    d={'label':label,'root':str(root),'world':str(world or root),'backup':backup,'server':server,'files':rows}
    (WORK/(label+'-plan.json')).write_bytes(enc(d))
    print(label,len(rows),'updates')

snapshot=json.loads((WORK/'server-before.json').read_text())
remote={p:base64.b64decode(b) if b is not None else None for p,b in snapshot.items()}
ops=dict(game)
for p in list(ops):
    if p.endswith('/manifest.json') and remote.get(p):ops[p]=metadata(remote[p],versions)
    else:ops[p]=content(p,remote.get(p),ops[p])
for prefix in ['', 'worlds/Bedrock level/']:
    for kind in ['behavior_packs','resource_packs']:
        p=prefix+'world_'+kind+'.json';d=parse(remote[p])
        for row in d:
            if row['pack_id'] in versions:row['version']=versions[row['pack_id']]
        ops[p]=enc(d)
# Unknown non-addition paths must be read before any server write.
for p in ops:
    assert p in remote or (p.startswith('behavior_packs/bp_16_') and '/scripts/' in p),p
    remote.setdefault(p,None)
plan('server','/opt/minecraft/server',remote,ops,True,'/opt/minecraft/server/worlds/Bedrock level')

for label,name in [('development','8v9pvwiD6QQ='),('latest','IC_Phase1_Fresh_20260911'),('aurealis','Aurealis_Pinene_Full_Test_20260830')]:
    root=WORLDS/name;existing={};ops={};available={}
    for kind in ['behavior_packs','resource_packs']:
        for p in (root/kind).glob('*/manifest.json'):
            try:d=parse(p.read_bytes())
            except:continue
            available[d['header']['uuid']]=p.parent
    local_versions={u:v for u,v in versions.items() if u in available}
    for rel,b in game.items():
        prefix='/'.join(rel.split('/')[:2]);u=source_manifests[prefix]['header']['uuid']
        if u not in available:continue
        p=available[u]/Path(*Path(rel).parts[2:]);key=p.relative_to(root).as_posix()
        existing[key]=read(p);ops[key]=metadata(existing[key],local_versions) if p.name=='manifest.json' and existing[key] else content(rel,existing[key],b)
    for kind in ['behavior_packs','resource_packs']:
        key='world_'+kind+'.json';existing[key]=read(root/key);d=parse(existing[key])
        for row in d:
            if row['pack_id'] in local_versions:row['version']=local_versions[row['pack_id']]
        ops[key]=enc(d)
    plan(label,root,existing,ops)

# Shared/source packs retain their UUID/version graph: these include older
# standalone names and worlds that reference them without embedded copies.
existing={};ops={}
for kind in ['behavior_packs','resource_packs','development_behavior_packs','development_resource_packs']:
    for manifest in (SHARED/kind).glob('*/manifest.json'):
        if manifest.parent.name.startswith('_'):continue
        try:d=parse(manifest.read_bytes())
        except:continue
        u=d['header']['uuid'];folder=manifest.parent
        for rel,b in game.items():
            prefix='/'.join(rel.split('/')[:2]);suffix=Path(*Path(rel).parts[2:])
            if suffix.name=='manifest.json':continue
            match=source_manifests[prefix]['header']['uuid']==u
            # Both merged and standalone Deathnerite copies define this same
            # sword. Remove the override from every installed matching copy.
            sword=rel.endswith('/attachables/deathnerite/parcanite/tools/parcanite_sword.json')
            if sword and (folder/suffix).is_file():
                match=parse((folder/suffix).read_bytes()).get('minecraft:attachable',{}).get('description',{}).get('identifier')=='true_dn:parcanite_sword'
            # The combined development BP also embeds this exact BSL table.
            if rel.endswith('/loot_tables/pots/trial_chambers/corridor.json') and (folder/suffix).exists():match=True
            if not match:continue
            p=folder/suffix;key=p.relative_to(SHARED).as_posix();existing[key]=read(p);ops[key]=content(rel,existing[key],b)
plan('shared',SHARED,existing,ops)
(WORK/'game-files.json').write_bytes(enc({p:sha(b) for p,b in game.items()}))
