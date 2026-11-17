"""Build a reversible, hash-checked RP patch; never edit the source server tree.

The separately managed rendering pack is discovered by UUID. Vanilla texture
files fall through to the client; private atlas aliases prevent Waystone's
similarly named atlas entries from replacing ordinary stained glass.
"""
from pathlib import Path
import argparse, copy, hashlib, json, zipfile

UUID = '917aab9c-5273-1000-ba5e-087a4328aa6b'
OLD, NEW = [1, 3, 46], [1, 3, 47]
COLORS = 'white orange magenta light_blue yellow lime pink gray light_gray cyan purple blue brown green red black'.split()
PREFIX = 'pinene_vanilla_glass__'

def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def digest(data): return hashlib.sha256(data).hexdigest()
def encoded(data): return (json.dumps(data, ensure_ascii=False, indent=2)+'\n').encode('utf-8')

def build(root, output):
    matches=[p.parent for p in (root/'resource_packs').glob('*/manifest.json') if read(p)['header']['uuid']==UUID]
    if len(matches)!=1: raise ValueError('Rendering pack UUID missing or ambiguous')
    pack=matches[0]; manifest=read(pack/'manifest.json')
    if manifest['header']['version']!=OLD: raise ValueError('Unexpected rendering pack version')
    mapping={'glass':'glass','glass_pane_top':'glass_pane_top','tinted_glass':'tinted_glass'}
    for color in COLORS:
        texture='silver' if color=='light_gray' else color
        mapping[color+'_stained_glass']='glass_'+texture
        mapping[color+'_stained_glass_pane_top']='glass_pane_top_'+texture
    mapping['stained_glass']=[mapping[c+'_stained_glass'] for c in COLORS]
    mapping['stained_glass_pane_top']=[mapping[c+'_stained_glass_pane_top'] for c in COLORS]
    def paths(v): return ['textures/blocks/'+x for x in v] if isinstance(v,list) else 'textures/blocks/'+v
    atlas=read(pack/'textures/terrain_texture.json'); old_atlas=copy.deepcopy(atlas)
    for key in list(atlas['texture_data']):
        if key.startswith('pinene_glass_carried_'): del atlas['texture_data'][key]
    for key,value in mapping.items(): atlas['texture_data'][PREFIX+key]={'textures':paths(value)}
    blocks=read(pack/'blocks.json'); old_blocks=copy.deepcopy(blocks)
    targets={'glass','glass_pane','tinted_glass','stained_glass','stained_glass_pane'}
    targets.update(c+suffix for c in COLORS for suffix in ['_stained_glass','_stained_glass_pane'])
    assert len(targets)==37 and targets <= blocks.keys()
    def alias(v):
        if isinstance(v,dict):return {k:alias(x) for k,x in v.items()}
        assert v in mapping,v
        return PREFIX+v
    for name in targets:
        blocks[name].pop('carried_textures',None)
        blocks[name]['textures']=alias(blocks[name]['textures'])
    assert {k:v for k,v in blocks.items() if k not in targets}=={k:v for k,v in old_blocks.items() if k not in targets}
    assert {k:v for k,v in atlas['texture_data'].items() if not k.startswith(PREFIX)}=={k:v for k,v in old_atlas['texture_data'].items() if not k.startswith('pinene_glass_carried_')}
    manifest['header']['version']=NEW
    for module in manifest['modules']:module['version']=NEW
    updates={pack/'manifest.json':encoded(manifest),pack/'blocks.json':encoded(blocks),pack/'textures/terrain_texture.json':encoded(atlas)}
    texture_names={x for v in mapping.values() for x in (v if isinstance(v,list) else [v])}
    names={name+ext for base in texture_names for name in [base,'pinene_glass_carried_'+base] for ext in ['.png','.tga','.texture_set.json','_normal.png','_mers.png','_mer.png','_height.png']}
    deleted=[p for p in pack.rglob('*') if p.is_file() and p.parent.name=='blocks' and p.name in names]
    assert len(deleted)==280, len(deleted)
    for p in deleted:updates[p]=None
    for rel in ['world_resource_packs.json','worlds/Bedrock level/world_resource_packs.json']:
        p=root/rel; refs=read(p); rows=[x for x in refs if x['pack_id']==UUID]
        expected=[1,3,37] if rel=='world_resource_packs.json' else OLD
        assert len(rows)==1 and rows[0]['version']==expected, (rel, rows)
        rows[0]['version']=NEW;updates[p]=encoded(refs)
    protected={}
    for p in [pack,root/'behavior_packs/pinene_connected_glass',root/'resource_packs/pinene_connected_glass']:
        assert p.is_dir()
        protected[p.relative_to(root).as_posix()]={f.relative_to(root).as_posix():digest(f.read_bytes()) for f in p.rglob('*') if f.is_file()}
    changes=[{'path':p.relative_to(root).as_posix(),'old_sha256':digest(p.read_bytes()),'new_sha256':digest(data) if data is not None else None} for p,data in sorted(updates.items())]
    plan={'world':'/opt/minecraft/server/worlds/Bedrock level','deployment_version':'1.3.47','changes':changes,'protected_packs':protected}
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('plan.json',encoded(plan))
        for p,data in updates.items():
            if data is not None:z.writestr('payload/'+p.relative_to(root).as_posix(),data)
    print(json.dumps({'blocks':len(targets),'removed_texture_assets':len(deleted),'changed_paths':len(changes),'version':NEW,'protected_packs':len(protected),'archive':str(output),'sha256':digest(output.read_bytes())}))

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('root',type=Path);ap.add_argument('output',type=Path)
    args=ap.parse_args();build(args.root.resolve(),args.output.resolve())
