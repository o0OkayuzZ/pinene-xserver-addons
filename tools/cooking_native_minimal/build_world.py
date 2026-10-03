"""Create-only world-local native integration. Does not edit live packs or existing worlds."""
from __future__ import annotations
import argparse,copy,hashlib,io,json,os,pathlib,shutil,struct,subprocess,sys,time,uuid,zipfile
from compiler import parse_data,compile_recipe,compile_board,LIMITS,native_counts
HERE=pathlib.Path(__file__).resolve().parent
WORLD_NAME='料理UI試験場（ナイフ連携）'
VERSION=[0,4,0]
UIDS={'food_bp':'7e540260-69ce-4a82-951d-bc793e151cd5','food_rp':'c81a6798-b6b1-4716-a514-c49967ad0ee2',
      'tool_bp':'211f47f7-5f1d-4b02-a162-e7546cf3fdc4','tool_rp':'392fe57f-87d4-4146-a8ba-5c548001ab45'}
PANCAKE_ITEM='behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/items/pancake.item.json'
PANCAKE_RP='resource_packs/rp_14_8f8c7cdb-60c5-4b4b-bc1c-334eb8f24b9a'
def encode(obj):return (json.dumps(obj,ensure_ascii=False,indent=2)+'\n').encode('utf-8')
def load(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def put(p,data):p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data)
def sha(data):return hashlib.sha256(data).hexdigest()
def git(repo,*args):return subprocess.run(['git','-C',str(repo),*args],check=True,capture_output=True).stdout

def locate(repo):
    found={}
    for kind in ['behavior_packs','resource_packs']:
        for p in (repo/kind).glob('*/manifest.json'):
            uid=load(p)['header']['uuid']
            for key,wanted in UIDS.items():
                if uid==wanted:
                    if key in found:raise ValueError('Duplicate source UUID '+uid)
                    found[key]=p.parent
    if set(found)!=set(UIDS):raise ValueError('Missing source packs; expand sparse checkout')
    return found

def level_dat(template):
    import nbtlib as n
    raw=template.read_bytes();v,size=struct.unpack('<II',raw[:8]);assert len(raw)==size+8
    src=n.File.parse(io.BytesIO(raw[8:]),byteorder='little')
    if int(src['Generator'])!=2:raise ValueError('Expected a known-working flat-world metadata source')
    keys=['StorageVersion','NetworkVersion','WorldVersion','InventoryVersion','lastOpenedWithVersion',
      'MinimumCompatibleClientVersion','baseGameVersion','FlatWorldLayers','NetherScale']
    d={k:copy.deepcopy(src[k]) for k in keys if k in src}
    flat=json.loads(str(d['FlatWorldLayers']))
    if flat.get('world_version')!='version.post_1_18' or sum(t['count'] for t in flat['block_layers'])!=4:raise ValueError('Wrong flat surface')
    for k,value in dict(Generator=2,GameType=0,Difficulty=0,SpawnX=0,SpawnY=-60,SpawnZ=0,
      LimitedWorldOriginX=0,LimitedWorldOriginY=-60,LimitedWorldOriginZ=0,spawnradius=0,
      serverChunkTickRange=4,randomtickspeed=0,playerPermissionsLevel=1,permissionsLevel=1).items():d[k]=n.Int(value)
    for k in ['ForceGameType','cheatsEnabled','commandsEnabled','hasBeenLoadedInCreative','keepinventory','doentitydrops','dotiledrops',
      'naturalregeneration','showcoordinates','showdeathmessages','recipesunlock','texturePacksRequired','sendcommandfeedback']:d[k]=n.Byte(1)
    for k in ['IsHardcore','MultiplayerGame','MultiplayerGameIntent','LANBroadcast','LANBroadcastIntent','bonusChestEnabled','bonusChestSpawned',
      'startWithMapEnabled','dodaylightcycle','doweathercycle','domobspawning','spawnMobs','mobgriefing','dofiretick','doinsomnia','tntexplodes',
      'educationFeaturesEnabled','immutableWorld','isFromWorldTemplate','hasLockedBehaviorPack','hasLockedResourcePack',
      'isWorldTemplateOptionLocked','isCreatedInEditor','commandblocksenabled']:d[k]=n.Byte(0)
    d.update(LevelName=n.String(WORLD_NAME),LastPlayed=n.Long(int(time.time())),RandomSeed=n.Long(2026100308),Time=n.Long(6000),
      currentTick=n.Long(0),rainLevel=n.Float(0),rainTime=n.Int(0),lightningLevel=n.Float(0),lightningTime=n.Int(0),
      XBLBroadcastIntent=n.Int(0),PlatformBroadcastIntent=n.Int(0),prid=n.String(''),
      experiments=n.Compound({'experiments_ever_used':n.Byte(0),'saved_with_toggled_experiments':n.Byte(0)}))
    out=io.BytesIO();n.File(d).write(out,byteorder='little');body=out.getvalue()
    parsed=n.File.parse(io.BytesIO(body),byteorder='little');assert str(parsed['prid'])==''
    return struct.pack('<II',v,len(body))+body

def make_world(repo,template,out):
    if out.exists():raise FileExistsError('Refusing existing build '+str(out))
    src=locate(repo);data=parse_data((src['tool_bp']/'scripts/cooking_data.js').read_text(encoding='utf-8-sig'))
    snapshot={str(p):sha(p.read_bytes()) for root in src.values() for p in root.rglob('*') if p.is_file()}
    ids={k:str(uuid.uuid4()) for k in src};root=out/'world';root.mkdir(parents=True)
    dest={}
    for key,source in src.items():
        group='behavior_packs' if key.endswith('_bp') else 'resource_packs';dest[key]=root/group/key
        shutil.copytree(source,dest[key])
        m=load(dest[key]/'manifest.json');m['header'].update(uuid=ids[key],version=VERSION,
          name='Pinene Native Minimal '+key,description='World-local native prototype; knife craft wear pending.')
        for mod in m['modules']:mod.update(uuid=str(uuid.uuid4()),version=VERSION)
        m.pop('dependencies',None)
        if key=='food_bp':m['dependencies']=[{'uuid':ids['food_rp'],'version':VERSION}]
        if key=='tool_bp':m['dependencies']=[{'uuid':ids[k],'version':VERSION} for k in ['tool_rp','food_bp']]+[{'module_name':'@minecraft/server','version':'2.7.0'}]
        put(dest[key]/'manifest.json',encode(m))
    for key in ['food_bp','tool_bp']:
        for folder in ['scripts','functions']:
            p=dest[key]/folder
            if p.exists():shutil.rmtree(p)
    # Delete JSON UI overrides only in the NEW world-local resource copy.
    if (dest['tool_rp']/'ui').exists():shutil.rmtree(dest['tool_rp']/'ui')
    for filename in ['native_boards.js','bootstrap.js']:put(dest['tool_bp']/'scripts'/filename,(HERE/filename).read_bytes())
    put(dest['tool_bp']/'scripts/main.js',b"import './native_boards.js';\nimport './bootstrap.js';\n")
    boards=[]
    for p in (dest['tool_bp']/'blocks').glob('*_cutting_board.json'):
        d=compile_board(load(p));d['format_version']='1.21.120';put(p,encode(d));boards.append(d['minecraft:block']['description']['identifier'])
    if len(boards)!=13:raise ValueError('Unexpected board inventory; review source')
    for p in (dest['tool_bp']/'entities').glob('placed_*_knife.json'):
        d=load(p);d['minecraft:entity']['components']['minecraft:inventory']={'inventory_size':1,'container_type':'inventory','can_be_siphoned_from':False,'private':True}
        put(p,encode(d))
    # Original culinary item properties and all approved texture bytes are kept.
    rp=dest['food_bp']/'recipes';shutil.rmtree(rp);rp.mkdir()
    entries=[]
    for recipe in data:
        for name,value in compile_recipe(recipe):put(rp/name,encode(value));entries.append((recipe,value))
    furnace=load(src['food_bp']/'recipes/whole_cheese_furnace.json')
    if furnace['minecraft:recipe_furnace']['output']!='pine:whole_cheese':raise ValueError('Changed furnace contract')
    put(rp/'whole_cheese_furnace.json',encode(furnace))
    # The monolithic pack already owns the base pancake. Include an exact copy
    # only in this isolated world so its four existing derivatives can be tested.
    pancake=git(repo,'show','HEAD:'+PANCAKE_ITEM);assert json.loads(pancake)['minecraft:item']['description']['identifier']=='myname:pancake'
    put(dest['food_bp']/'items/pancake_dependency.json',pancake)
    atlas=load(dest['food_rp']/'textures/item_texture.json')
    patlas=json.loads(git(repo,'show','HEAD:'+PANCAKE_RP+'/textures/item_texture.json'))
    entry=patlas['texture_data']['pancake'];assert entry['textures']=='textures/items/pancake'
    atlas['texture_data']['pancake']=entry;put(dest['food_rp']/'textures/item_texture.json',encode(atlas))
    png=git(repo,'show','HEAD:'+PANCAKE_RP+'/textures/items/pancake.png');assert png.startswith(b'\x89PNG\r\n\x1a\n')
    put(dest['food_rp']/'textures/items/pancake.png',png)
    for group,keys in [('behavior_packs',['tool_bp','food_bp']),('resource_packs',['tool_rp','food_rp'])]:
        put(root/('world_'+group+'.json'),encode([{'pack_id':ids[k],'version':VERSION} for k in keys]))
    raw=level_dat(template)
    for name in ['level.dat','level.dat_old']:put(root/name,raw)
    put(root/'levelname.txt',WORLD_NAME.encode('utf-8'))
    import leveldb
    db=leveldb.LevelDB(str(root/'db'),create_if_missing=True);db.close()
    report={'world_name':WORLD_NAME,'source_commit':git(repo,'rev-parse','HEAD').decode().strip(),'source_recipes':len(data),
      'basic_materials':sum(r['rank']==0 for r in data),'culinary_recipes':sum(r['rank']>0 for r in data),
      'native_recipe_files':len(entries)+1,'board_types':len(boards),'knife_limits':LIMITS,'world_pack_ids':ids,
      'source_hashes':snapshot,'pancake_source':PANCAKE_ITEM,'pancake_texture_source':PANCAKE_RP+'/textures/items/pancake.png',
      'ui_overrides':False,'experimental_toggles':False,'knife_wear_implemented':False,'mixed_seeds_implemented':False,
      'multiplayer_supported':False,'native_rendering_verified':False,'native_rank_filtering_verified':False}
    if any(sha(pathlib.Path(p).read_bytes())!=h for p,h in snapshot.items()):raise RuntimeError('Source changed concurrently; do not publish')
    validate(root,data)
    put(out/'validation_report.json',encode(report));put(out/'recipes.source.json',encode(data))
    with zipfile.ZipFile(out/'Pinene_Native_Minimal_World.mcworld','x',zipfile.ZIP_DEFLATED) as z:
        for p in root.rglob('*'):
            if p.is_file() and p.name!='LOCK':z.write(p,p.relative_to(root).as_posix())
    with zipfile.ZipFile(out/'Pinene_Native_Minimal_World.mcworld') as z:assert z.testzip() is None
    return root,report

def validate(root,data):
    assert not list(root.glob('**/ui/*.json'))
    for p in root.rglob('*.json'):load(p)
    food=root/'behavior_packs/food_bp';known={load(p)['minecraft:item']['description']['identifier'] for p in (food/'items').glob('*.json')}
    required={r['id'] for r in data}|{id for r in data for p in r['ingredients'] for id in p.get('ids',[p.get('id')])}
    if any(not id.startswith('minecraft:') and id not in known for id in required):raise ValueError('Missing food dependency')
    recipe_ids=[];patterns=[]
    for p in (food/'recipes').glob('*.json'):
        d=load(p);k=next(k for k in d if k.startswith('minecraft:recipe_'));b=d[k];recipe_ids.append(b['description']['identifier'])
        if k.endswith('furnace'):continue
        assert b['tags'][0].startswith('pinene_native_rank_') and len(b['tags'])==1
        patterns.append((tuple(b['tags']),tuple(sorted(native_counts(d).items()))))
    assert len(recipe_ids)==len(set(recipe_ids));assert len(patterns)==len(set(patterns))
    scripts=root/'behavior_packs/tool_bp/scripts'
    for p in scripts.glob('*.js'):
        text=p.read_text(encoding='utf-8');assert 'ActionFormData' not in text and 'CustomForm' not in text
        subprocess.run(['node','--check',str(p)],check=True,capture_output=True)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    for k in ['repo','template','out','vendor']:p.add_argument('--'+k,type=pathlib.Path,required=True)
    p.add_argument('--install-to',type=pathlib.Path)
    a=p.parse_args();sys.path.insert(0,str(a.vendor))
    if a.install_to and a.install_to.exists():raise FileExistsError('Refusing to replace existing world')
    root,report=make_world(a.repo,a.template,a.out)
    if a.install_to:
        if not a.install_to.parent.is_dir():raise ValueError('Unknown destination directory')
        hashes={str(f.relative_to(root)):sha(f.read_bytes()) for f in root.rglob('*') if f.is_file()}
        os.rename(root,a.install_to)
        assert all(sha((a.install_to/f).read_bytes())==h for f,h in hashes.items())
        report['installed_world']=str(a.install_to);report['installed_files']=len(hashes)
        put(a.out/'validation_report.json',encode(report))
    print(json.dumps({k:v for k,v in report.items() if k!='source_hashes'},ensure_ascii=False))
if __name__=='__main__':main()
