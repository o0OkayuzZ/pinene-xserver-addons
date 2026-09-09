import copy
import datetime
import hashlib
import json
import pathlib
import uuid

HOME = pathlib.Path.home()
REPO = pathlib.Path(__file__).resolve().parents[1]
ROOT = HOME / 'AppData/Roaming/Minecraft Bedrock/Users/10345784260749742919/games/com.mojang/minecraftWorlds'
WORLDS = [ROOT / 'Aurealis_Pinene_Full_Test_20260830', ROOT / '8v9pvwiD6QQ=']
BP = pathlib.Path('behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880')
RP = pathlib.Path('resource_packs/rp_05_608f921e-6be8-4a27-85d6-27945fa3a1ef')
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def encode(v): return (json.dumps(v, ensure_ascii=False, indent=2)+'\n').encode('utf-8')
def digest(b): return hashlib.sha256(b).hexdigest()
def uid(s): return str(uuid.uuid5(uuid.NAMESPACE_URL, 'pinene-golden-foods-standalone-v011/'+s))
ops = {}
def put(p,b):
    p=p.resolve()
    assert any(p.is_relative_to(w.resolve()) for w in WORLDS)
    ops[p]=b
changes=(REPO/'docs/golden_foods/CHANGED_FILES.txt').read_text(encoding='utf-8-sig').splitlines()
bfiles=[pathlib.Path(p).relative_to(BP) for p in changes if p.startswith(BP.as_posix()+'/') and pathlib.Path(p).parts[2] in ('items','recipes','scripts')]
rfiles=[pathlib.Path(p).relative_to(RP) for p in changes if p.startswith(RP.as_posix()+'/textures/pinene_golden_foods/')]
assert len(bfiles)==41 and len(rfiles)==10
atlas={k:v for k,v in read(REPO/RP/'textures/item_texture.json')['texture_data'].items() if k.startswith('pinene_golden_foods_')}
assert len(atlas)==10
source_manifest=read(REPO/BP/'manifest.json')
source_manifests={read(p)['header']['uuid']:read(p) for kind in ['behavior_packs','resource_packs'] for p in (REPO/kind).glob('*/manifest.json')}
for i,w in enumerate(WORLDS):
    assert (w/'level.dat').is_file()
    regs={kind:read(w/f'world_{kind}.json') for kind in ['behavior_packs','resource_packs']}
    if i==0:
        bp=w/'behavior_packs/Pinene_Golden_Foods_v011_BP'
        rp=w/'resource_packs/Pinene_Golden_Foods_v011_RP'
        assert not bp.exists() and not rp.exists(), 'Already deployed; inspect before repeating'
        for kind,path,typ in [('behavior_packs',bp,'data'),('resource_packs',rp,'resources')]:
            m={'format_version':2,'header':{'name':'Pinene Golden Foods v0.1.1 '+('BP' if typ=='data' else 'RP'),'description':'Golden foods, recipes, textures and optional guide.','uuid':uid(kind),'version':[0,1,1],'min_engine_version':[1,21,90]},'modules':[{'type':typ,'uuid':uid(typ),'version':[0,1,1]}]}
            if typ=='data':
                sm=copy.deepcopy(next(x for x in source_manifest['modules'] if x['type']=='script'))
                sm.update(uuid=uid('script'),version=[0,1,1]); m['modules'].append(sm)
                m['dependencies']=[copy.deepcopy(x) for x in source_manifest['dependencies'] if 'module_name' in x]+[{'uuid':uid('resource_packs'),'version':[0,1,1]}]
            put(path/'manifest.json',encode(m))
            regs[kind].append({'pack_id':m['header']['uuid'],'version':[0,1,1]})
        a={'resource_pack_name':'pinene_golden_foods','texture_name':'atlas.items','texture_data':atlas}
    else:
        bp=w/BP; rp=w/RP
        manifests={read(p)['header']['uuid']:(p,read(p)) for kind in regs for p in (w/kind).glob('*/manifest.json')}
        bm=manifests[source_manifest['header']['uuid']][1]
        assert not any(m['type']=='script' for m in bm['modules'])
        bm['modules'].append(copy.deepcopy(next(m for m in source_manifest['modules'] if m['type']=='script')))
        bm['header']['min_engine_version']=list(max(tuple(bm['header'].get('min_engine_version',[])),(1,21,90)))
        bm.setdefault('dependencies',[]).extend(copy.deepcopy(source_manifest['dependencies']))
        changed={source_manifest['header']['uuid'],read(REPO/RP/'manifest.json')['header']['uuid']}
        core=w/'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639'
        for n in ['gwheat.json','egwheat.json']:
            p=core/'recipes'/n
            if p.exists():
                assert 'wheat' in p.read_text(encoding='utf-8-sig')
                put(p,None); changed.add(read(core/'manifest.json')['header']['uuid'])
        while True:
            extra={u for u,(_,m) in manifests.items() if any(d.get('uuid') in changed for d in m.get('dependencies',[]))}
            if extra<=changed: break
            changed |= extra
        versions={}
        for u in changed:
            m=manifests[u][1]; v=list(max(tuple(m['header']['version']),tuple(source_manifests.get(u,m)['header']['version']))); v[-1]+=1; versions[u]=v
        for u in changed:
            p,m=manifests[u]; m['header']['version']=versions[u]
            for mod in m['modules']: mod['version']=versions[u]
            for dep in m.get('dependencies',[]):
                if dep.get('uuid') in versions: dep['version']=versions[dep['uuid']]
            put(p,encode(m))
        for entries in regs.values():
            for entry in entries:
                if entry['pack_id'] in versions: entry['version']=versions[entry['pack_id']]
        a=read(rp/'textures/item_texture.json'); a['texture_data'].update(atlas)
    for f in bfiles: put(bp/f,(REPO/BP/f).read_bytes())
    for f in rfiles: put(rp/f,(REPO/RP/f).read_bytes())
    put(rp/'textures/item_texture.json',encode(a))
    for kind,entries in regs.items(): put(w/f'world_{kind}.json',encode(entries))

# Validate the planned active packs before modifying either world.
shared=HOME/'AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang'
def proposed(p): return ops[p.resolve()] if p.resolve() in ops else p.read_bytes()
def obj(p): return json.loads(proposed(p).decode('utf-8-sig'))
for w in WORLDS:
    all_manifests={p.resolve() for k in ['behavior_packs','resource_packs'] for p in (w/k).glob('*/manifest.json')}
    all_manifests|={p for p,b in ops.items() if p.is_relative_to(w.resolve()) and p.name=='manifest.json' and b is not None}
    all_manifests|={p.resolve() for k in ['development_behavior_packs','development_resource_packs','behavior_packs','resource_packs'] for p in (shared/k).glob('*/manifest.json')}
    # World-local definitions take priority over shared development copies.
    packs={}
    for p in sorted(all_manifests,key=lambda p:p.is_relative_to(w.resolve())): packs[obj(p)['header']['uuid']]=(p,obj(p))
    active={}
    for kind in ['behavior_packs','resource_packs']:
        for e in obj(w/f'world_{kind}.json'):
            assert e['pack_id'] in packs, ('unresolved pack',e)
            p,m=packs[e['pack_id']]; assert m['header']['version']==e['version'],('version mismatch',str(p))
            active[e['pack_id']]=(p,m)
    for p,m in active.values():
        for d in m.get('dependencies',[]):
            if d.get('uuid') in active: assert d['version']==active[d['uuid']][1]['header']['version'],('dependency mismatch',str(p),d)
    seen={}
    own_ids=set()
    for f in bfiles:
        if f.parts[0] in ('items','recipes'):
            for v in read(REPO/BP/f).values():
                if isinstance(v,dict) and 'description' in v: own_ids.add((f.parts[0],v['description']['identifier']))
    for p,m in active.values():
        for kind in ['items','recipes']:
            files=set((p.parent/kind).rglob('*.json'))|{f for f,b in ops.items() if f.is_relative_to(p.parent/kind) and b is not None}
            for f in files:
                if f.resolve() in ops and ops[f.resolve()] is None: continue
                try: data=obj(f)
                except (UnicodeError,json.JSONDecodeError): continue
                for v in data.values():
                    ident=v.get('description',{}).get('identifier') if isinstance(v,dict) else None
                    key=(kind,ident)
                    if key in own_ids:
                        assert key not in seen,('duplicate golden ID',key,str(f),str(seen.get(key)))
                        seen[key]=f
    assert own_ids<=seen.keys(), 'missing golden definitions'

stamp=datetime.datetime.now().strftime('%Y%m%d_%H%M%S_%f')
backup=HOME/'Downloads/pinene-gf-backups'/('golden_foods_two_worlds_'+stamp)
backup.mkdir(parents=True)
before={p:p.read_bytes() if p.exists() else None for p in ops}
protected_paths={p for w in WORLDS for kind in ['behavior_packs','resource_packs'] for p in (w/kind).rglob('*') if p.is_file() and p.resolve() not in ops}
protected_paths|={w/n for w in WORLDS for n in ['level.dat','levelname.txt'] if (w/n).is_file()}
protected={p:digest(p.read_bytes()) for p in protected_paths}
records=[]
for p,b in before.items():
    rel=p.relative_to(ROOT)
    if b is not None:
        q=backup/rel; q.parent.mkdir(parents=True,exist_ok=True); q.write_bytes(b)
    records.append({'path':str(p),'backup_relative':rel.as_posix() if b is not None else None,'before_sha256':digest(b) if b is not None else None,'after_sha256':digest(ops[p]) if ops[p] is not None else None})
(backup/'rollback_manifest.json').write_bytes(encode(records))
try:
    for p,b in ops.items():
        if b is None: p.unlink()
        else: p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(b)
    for p,b in ops.items(): assert (p.read_bytes()==b) if b is not None else not p.exists()
    for p,h in protected.items(): assert p.is_file() and digest(p.read_bytes())==h,('unrelated file changed',str(p))
except Exception:
    for p,b in before.items():
        if b is None:
            if p.exists(): p.unlink()
        else: p.write_bytes(b)
    raise
report={'state':'APPLIED','timestamp':stamp,'worlds':[{'folder':str(w),'name':(w/'levelname.txt').read_text(encoding='utf-8-sig').strip()} for w in WORLDS],'backup':str(backup),'operations':len(ops),'unchanged_files_verified':len(protected),'preflight':'active registrations, dependency versions, golden item and recipe uniqueness PASS','file_verification':'PASS','in_game_test':False,'records':records}
(REPO/'docs/golden_foods/TWO_WORLDS_DEPLOYMENT.json').write_bytes(encode(report))
print(json.dumps({k:v for k,v in report.items() if k!='records'},ensure_ascii=True,indent=2))
