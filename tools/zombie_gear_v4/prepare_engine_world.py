"""Create a new disposable world; never edits an existing world's database."""
from pathlib import Path
import io,json,struct,shutil,uuid,zipfile,argparse
import nbtlib
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--template-world',type=Path,required=True,help='Read only: existing flat world containing level.dat')
parser.add_argument('--output',type=Path,default=Path.home()/'Downloads/zg-final-engine-world')
args=parser.parse_args()
DEST=args.output
DEST.mkdir(exist_ok=True)
template=args.template_world/'level.dat'
raw=template.read_bytes(); nbt=nbtlib.File.parse(io.BytesIO(raw[8:]),byteorder='little')
nbt['LevelName']=nbtlib.String('Zombie Gear FINAL isolated validation')
for k,v in {'GameType':0,'Difficulty':0,'Generator':2,'SpawnX':0,'SpawnY':-60,'SpawnZ':0,'NetworkVersion':nbt.get('NetworkVersion',0)}.items():nbt[k]=nbtlib.Int(v)
for k,v in {'commandsEnabled':1,'cheatsEnabled':1,'hasBeenLoadedInCreative':1,'doMobSpawning':0,'naturalregeneration':0,'keepinventory':1,'MultiplayerGame':0,'MultiplayerGameIntent':0}.items():nbt[k]=nbtlib.Byte(v)
nbt['FlatWorldLayers']=nbtlib.String('{"biome_id":1,"block_layers":[{"block_data":0,"block_id":"minecraft:bedrock","count":1},{"block_data":0,"block_id":"minecraft:dirt","count":2},{"block_data":0,"block_id":"minecraft:grass_block","count":1}],"encoding_version":6,"structure_options":null,"world_version":"version.post_1_18"}')
buf=io.BytesIO();nbt.write(buf,byteorder='little');data=buf.getvalue()
(DEST/'level.dat').write_bytes(struct.pack('<II',10,len(data))+data)
(DEST/'levelname.txt').write_text('Zombie Gear FINAL isolated validation',encoding='utf-8')
packs=[]
for folder,name in [('behavior_packs','bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1'),('resource_packs','rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10')]:
    dest=DEST/folder/'zombiegear_final_test';shutil.copytree(ROOT/folder/name,dest,dirs_exist_ok=True)
    m=json.loads((dest/'manifest.json').read_text(encoding='utf-8-sig'))
    m['header']['uuid']=str(uuid.uuid5(uuid.NAMESPACE_DNS,'zombiegear-final-test-'+folder));m['header']['name']='ZombieGear FINAL TEST '+folder
    for i,module in enumerate(m['modules']):module['uuid']=str(uuid.uuid5(uuid.NAMESPACE_DNS,f'zombiegear-final-test-{folder}-{i}'))
    m['dependencies']=[d for d in m.get('dependencies',[]) if 'module_name' in d]
    (dest/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
    (DEST/f'world_{"behavior" if folder=="behavior_packs" else "resource"}_packs.json').write_text(json.dumps([{'pack_id':m['header']['uuid'],'version':m['header']['version']}]),encoding='utf-8')
    packs.append(dest)
bp=packs[0]
main=bp/'scripts/main.js'
main.write_text(main.read_text(encoding='utf-8')+'\nexport { corruption, revives, tryRevive, setScore, SCORE, forceMaxHpState, syncStrengthBoost, knockback, beginCharge, tickChargeCompletion };\nimport "./engine-smoke.js";\n',encoding='utf-8')
shutil.copyfile(ROOT/'tools/zombie_gear_v4/engine-final-smoke.js',bp/'scripts/engine-smoke.js')
cell={'format_version':'1.21.0','minecraft:item':{'description':{'identifier':'pinematerials:zonbikansaibou'},'components':{'minecraft:icon':'zombie_stem_cell','minecraft:max_stack_size':64}}}
(bp/'items/test_stem_cell.json').write_text(json.dumps(cell),encoding='utf-8')
archive=DEST.with_suffix('.mcworld')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for p in DEST.rglob('*'):
        if p.is_file():z.write(p,p.relative_to(DEST))
print(archive)
