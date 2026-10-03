from pathlib import Path
import json,re
R=Path(__file__).resolve().parents[2]
import argparse
parser=argparse.ArgumentParser()
parser.add_argument('--game-resource-packs',required=True)
parser.add_argument('--mojang-root',required=True)
args=parser.parse_args()
GAME=Path(args.game_resource_packs)
LOCAL=Path(args.mojang_root)
assert GAME.is_dir() and LOCAL.is_dir(), 'Resource roots must exist'
OUT=R/'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/inventory_icons.generated.js'
def load(p):
 try:return json.loads(p.read_text('utf-8-sig'))
 except Exception:return {}
def roots(p):return [x for x in p.iterdir() if x.is_dir() and not x.name.startswith(('_','.','%')) and (x/'manifest.json').exists()]
def tex(v):
 if isinstance(v,str):return v.removesuffix('.png').removesuffix('.tga')
 if isinstance(v,list):return tex(v[0]) if v else None
 if isinstance(v,dict):return tex(v.get('textures',v.get('path',v.get('default'))))
 return None
known=set()
for p in GAME.glob('*/contents.json'):
 for entry in load(p).get('content',[]):
  t=entry.get('path','').replace('\\','/')
  if t.endswith(('.png','.tga')):known.add(t.rsplit('.',1)[0])
rps=roots(LOCAL/'development_resource_packs')+roots(R/'resource_packs')
bps=roots(LOCAL/'development_behavior_packs')+roots(R/'behavior_packs')
atlas={};terrain={};block_defs={}
for rp in rps:
 for p in (rp/'textures').rglob('*'):
  if p.suffix.lower() in ('.png','.tga'):known.add(p.relative_to(rp).as_posix().rsplit('.',1)[0])
 atlas.update(load(rp/'textures/item_texture.json').get('texture_data',{}))
 terrain.update(load(rp/'textures/terrain_texture.json').get('texture_data',{}))
 block_defs.update(load(rp/'blocks.json'))
icons={}
# Generate only names backed by an existing resource entry, not guessed paths at runtime.
for kind in ['blocks','items']:
 for p in sorted(known):
  if p.startswith('textures/'+kind+'/') and '/' not in p[len('textures/'+kind+'/'):] and not any(p.endswith(x) for x in ('_normal','_mers','_mer','_heightmap')):
   icons['minecraft:'+p.rsplit('/',1)[-1]]=p
src=(R/'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/main.js').read_text('utf-8-sig')
base=re.search(r'const INVENTORY_ICON_OVERRIDES = (\{.*?\n\});',src,re.S)
if base:
 icons.update(json.loads(re.sub(r',\s*}', '}', base.group(1))))
else:
 previous=OUT.read_text('utf-8') if OUT.exists() else ''
 if previous:
  previous=json.loads(previous.split('export const INVENTORY_ICONS = ',1)[1].strip().removesuffix(';'))
  icons.update({k:v for k,v in previous.items() if k.startswith('minecraft:') and v in known})
alias={'chest':'blocks/chest_front','trapped_chest':'blocks/trapped_chest_front','ender_chest':'blocks/ender_chest_front','jukebox':'blocks/jukebox_side','noteblock':'blocks/noteblock','piston':'blocks/piston_top_normal','sticky_piston':'blocks/piston_top_sticky','crafting_table':'blocks/crafting_table_front','furnace':'blocks/furnace_front_off','smoker':'blocks/smoker_front_off','blast_furnace':'blocks/blast_furnace_front_off','prismarine':'blocks/prismarine_rough','prismarine_bricks':'blocks/prismarine_bricks','dark_prismarine':'blocks/prismarine_dark','grass_block':'blocks/grass_side_carried','oak_log':'blocks/log_oak','spruce_log':'blocks/log_spruce','birch_log':'blocks/log_birch','jungle_log':'blocks/log_jungle','acacia_log':'blocks/log_acacia','dark_oak_log':'blocks/log_big_oak','golden_apple':'items/apple_golden','enchanted_golden_apple':'items/apple_golden','porkchop':'items/porkchop_raw','beef':'items/beef_raw','chicken':'items/chicken_raw','rabbit':'items/rabbit_raw','mutton':'items/mutton_raw','cod':'items/fish_raw','salmon':'items/fish_salmon_raw','cooked_cod':'items/fish_cooked','cooked_salmon':'items/fish_salmon_cooked','experience_bottle':'items/experience_bottle','potion':'items/potion_bottle_drinkable','snowball':'items/snowball','red_mushroom':'blocks/mushroom_red','brown_mushroom':'blocks/mushroom_brown'}
for mat,old in [('wooden','wood'),('golden','gold')]:
 for tool in ['sword','pickaxe','shovel','axe','hoe','helmet','chestplate','leggings','boots']:
  alias[mat+'_'+tool]='items/'+old+'_'+tool
icons.update({'minecraft:'+k:'textures/'+v for k,v in alias.items() if 'textures/'+v in known})
missing=[];custom_count=0
for bp in bps:
 for p in (bp/'items').rglob('*.json'):
  item=load(p).get('minecraft:item',{});ident=item.get('description',{}).get('identifier');components=item.get('components',{})
  icon=components.get('minecraft:icon')
  if isinstance(icon,dict):icon=icon.get('texture',icon.get('textures',{}).get('default'))
  path=tex(atlas.get(icon)) if isinstance(icon,str) else None
  if ident and path in known:icons[ident]=path;custom_count+=1
  elif ident:missing.append(ident)
 for p in (bp/'blocks').rglob('*.json'):
  b=load(p).get('minecraft:block',{});ident=b.get('description',{}).get('identifier');m=b.get('components',{}).get('minecraft:material_instances',{})
  t=m.get('*',{}).get('texture');path=tex(terrain.get(t))
  if ident and path in known:icons[ident]=path
for ident,b in block_defs.items():
 if not isinstance(b,dict):continue
 t=b.get('textures')
 if isinstance(t,dict):t=t.get('side',t.get('up',t.get('north')))
 if isinstance(t,str):
  path=tex(terrain.get(t))
  if path in known:icons[ident if ':' in ident else 'minecraft:'+ident]=path
import subprocess
repo_paths=subprocess.check_output(['git','ls-tree','-r','--name-only','HEAD'],cwd=R,text=True,encoding='utf-8').splitlines()
known.update('/'.join(p.split('/')[2:]).rsplit('.',1)[0] for p in repo_paths if p.startswith('resource_packs/') and p.endswith(('.png','.tga')))
icons.update(load(R/'tools/cooking_ui/extra_icon_sources.json'))
icons={k:v for k,v in icons.items() if v in known}
OUT.write_text('// Generated from installed resource manifests and item icon definitions.\n// No runtime path guessing; unknown items use a visible ? marker.\nexport const INVENTORY_ICONS = '+json.dumps(icons,ensure_ascii=False,sort_keys=True,indent=2)+';\n','utf-8')
report={'count':len(icons),'customDefinitionsResolved':custom_count,'unresolvedCustomIds':sorted(set(missing)-set(icons)),'verifiedTextureCount':len(known),'note':'This map is a 2D inventory snapshot, not a native inventory renderer; unknown icons are logged, never guessed.'}
(R/'docs/cooking-ui-icon-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n','utf-8')
print('ICON_MAP',len(icons),'CUSTOM',custom_count,'UNRESOLVED',report['unresolvedCustomIds'])
print('SCREENSHOT_BLOCKS',{k:icons.get('minecraft:'+k) for k in ['jukebox','chest','piston','gold_block','glowstone','crafting_table']})