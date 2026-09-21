#!/usr/bin/env python3
"""Generate pack JSON, JS registry, localization and readable catalog from canonical data."""
from pathlib import Path
import json,uuid,csv
from build_items import nf_slug, sync_icons, sync_nether_icons
sync_icons()
sync_nether_icons()
ROOT=Path(__file__).resolve().parents[1];BP=ROOT/'pack/BP';RP=ROOT/'pack/RP'
D=json.loads((ROOT/'data/mushrooms.json').read_text(encoding='utf8')); E=D['mushrooms'];S=json.loads((ROOT/'data/sources.json').read_text(encoding='utf8'))
NF_MASTER=json.loads((ROOT/'data/nether_fungi_master_v1.0.json').read_text(encoding='utf8'))
assert len({e['id'] for e in NF_MASTER['entries']}) == len(NF_MASTER['entries']), 'Duplicate NF IDs'
assert all(e['id'] == f"NF-{e['number']:03d}" for e in NF_MASTER['entries'])
assert [e['number'] for e in NF_MASTER['entries']] == sorted({e['number'] for e in NF_MASTER['entries']}), 'Append new NF numbers in ascending order to preserve discovery bits'
family_indexes={'crimson':0,'warped':0}
N=[]
for source in NF_MASTER['entries']:
 number=source['number'];family=source['family'];slug=nf_slug(number)
 entry=dict(source)
 entry.update({
  'indexInGroup':family_indexes[family],
  'group':family,
  'itemId':f'pinene:{slug}',
  'nameJa':source['display_name'],
  'scientificName':source['scientific_name'],
  'rarity':source['stars'],
  'drawWeight':source['draw_weight'],
  'textureKey':f'pinene_myco_{slug}',
  'texturePath':f'textures/items/mycology/nf/{slug}',
  'useMode':'specimen'
 })
 family_indexes[family]+=1
 N.append(entry)
# The original release stays 50/50; later entries may extend either family.
assert {family:sum(e['family']==family and e['number']<=100 for e in N) for family in family_indexes} == {'crimson':50,'warped':50}
def jsave(p,o):p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(o,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def uid(s):return str(uuid.uuid5(uuid.NAMESPACE_URL,'pinene-mycology-v1/'+s))
for side in ['BP','RP']:
 m={'format_version':2,'header':{'name':f'[TEST] Pinene Mycology {side} 1.2.0-handoff','description':'Mushroom Appraiser / local validation candidate; do not deploy over production packs','uuid':uid(side),'version':[1,2,0],'min_engine_version':[1,21,90]},'modules':[{'type':'data' if side=='BP' else 'resources','uuid':uid(side+'-content'),'version':[1,2,0]}],'metadata':{'authors':['Pinene / AI-assisted production'],'product_type':'addon'}}
 if side=='BP':
  m['modules'].append({'type':'script','language':'javascript','entry':'scripts/main.js','uuid':uid('script'),'version':[1,2,0]})
  m['dependencies']=[{'uuid':uid('RP'),'version':[1,2,0]},{'module_name':'@minecraft/server','version':'2.7.0'},{'module_name':'@minecraft/server-ui','version':'2.0.0'}]
 jsave(ROOT/f'pack/{side}/manifest.json',m)
rt=[];lang={'entity.pinene:mushroom_appraiser.name':'キノコ鑑定士','myco.warning':D['warningJa'],'myco.title':'菌類図鑑','myco.science':'科学解説','myco.game':'ゲーム内表現','myco.joke':'鑑定士のひとこと','myco.unknown':'未発見','myco.back':'戻る'}
texdata={}
for e in E:
 k=e['id'].lower();stem=f'myco.{k}';e=dict(e)
 # Long references and editorial notes never enter gameplay scripts.
 rt.append({k2:v for k2,v in e.items() if k2 not in ['scienceJa','gameExplanationJa','jokeJa','sourceIds','taxonomyNote','scientificNameAliases','materialUses']})
 for field,suf in [('nameJa','name'),('scienceJa','science'),('gameExplanationJa','game'),('jokeJa','joke')]:lang[f'{stem}.{suf}']=e[field]
 lang[f'item.{e["itemId"]}.name']=e['nameJa']
 c={'minecraft:display_name':{'value':f'{stem}.name'},'minecraft:icon':{'textures':{'default':e['textureKey']}},'minecraft:max_stack_size':64}
 if e['useMode']=='crush': c['minecraft:cooldown']={'category':'pinene_mushroom','duration':e['cooldownSeconds']}
 if e['useMode']=='eat':
  f=e['food'];c.update({'minecraft:food':{'nutrition':f['nutrition'],'saturation_modifier':f['saturationModifier'],'can_always_eat':True},'minecraft:use_modifiers':{'use_duration':1.6,'movement_modifier':0.35},'minecraft:use_animation':'eat','pinene:myco_consume':{}})
 elif e['useMode']=='crush':c.update({'minecraft:use_modifiers':{'use_duration':0.1,'movement_modifier':1.0},'pinene:myco_crush':{}})
 jsave(BP/f'items/mycology/{k}.json',{'format_version':'1.21.90','minecraft:item':{'description':{'identifier':e['itemId'],'menu_category':{'category':'items'}},'components':c}})
 texdata[e['textureKey']]={'textures':e['texturePath']}
for e in N:
 k=f"nf_{e['number']:03d}";stem=f"myco.{k}"
 lang[f'{stem}.name']=e['display_name']
 lang[f'item.{e["itemId"]}.name']=e['display_name']
 c={'minecraft:display_name':{'value':f'{stem}.name'},'minecraft:icon':{'textures':{'default':e['textureKey']}},'minecraft:max_stack_size':64}
 jsave(BP/f'items/mycology/nf/{k}.json',{'format_version':'1.21.90','minecraft:item':{'description':{'identifier':e['itemId'],'menu_category':{'category':'items'}},'components':c}})
 texdata[e['textureKey']]={'textures':e['texturePath']}
jsave(RP/'textures/item_texture.json',{'resource_pack_name':'pinene_mycology','texture_name':'atlas.items','texture_data':texdata})
jsave(RP/'texts/languages.json',['en_US','ja_JP'])
for locale in ['ja_JP','en_US']:
 # Intentional Japanese fallback for en_US. English translation is deferred; never show missing keys.
 (RP/f'texts/{locale}.lang').write_text('\n'.join(k+'='+str(v).replace('\n','\\n') for k,v in lang.items())+'\n',encoding='utf8')
(BP/'scripts/mycology/registry.js').write_text(
 '// Generated by tools/build_pack.py. Edit data/mushrooms.json or data/nether_fungi_master_v1.0.json instead.\n'
 +'export const MUSHROOMS = '+json.dumps(rt,ensure_ascii=False,separators=(',',':'))+';\n'
 +'export const NETHER_FUNGI = '+json.dumps(N,ensure_ascii=False,separators=(',',':'))+';\n'
 +'export const ALL_FUNGI = [...MUSHROOMS,...NETHER_FUNGI];\n'
 +'export const BY_ID = new Map(ALL_FUNGI.map(x=>[x.id,x]));\n'
 +'export const BY_ITEM = new Map(ALL_FUNGI.map(x=>[x.itemId,x]));\n',encoding='utf8')
entity={'format_version':'1.21.0','minecraft:entity':{'description':{'identifier':'pinene:mushroom_appraiser','is_spawnable':True,'is_summonable':True,'is_experimental':False},'components':{
'minecraft:type_family':{'family':['pinene_appraiser','mob']},'minecraft:health':{'value':40,'max':40},'minecraft:collision_box':{'width':0.6,'height':1.95},'minecraft:persistent':{},
'minecraft:movement':{'value':0.22},'minecraft:movement.basic':{},'minecraft:jump.static':{},'minecraft:navigation.walk':{'can_path_over_water':False,'avoid_water':True,'avoid_damage_blocks':True,'can_pass_doors':True,'can_open_doors':False},'minecraft:physics':{},'minecraft:pushable':{'is_pushable':True,'is_pushable_by_piston':True},
'minecraft:behavior.float':{'priority':0},'minecraft:behavior.panic':{'priority':1,'speed_multiplier':1.4},'minecraft:behavior.random_stroll':{'priority':6,'speed_multiplier':0.6},'minecraft:behavior.look_at_player':{'priority':7,'look_distance':6,'probability':0.04},'minecraft:behavior.random_look_around':{'priority':8},
'minecraft:interact':{'interactions':[{'on_interact':{'event':'pinene:interacted','target':'self'},'interact_text':'action.interact.trade'}]}},'events':{'pinene:interacted':{}}}}
jsave(BP/'entities/mushroom_appraiser.json',entity)
# Debug functions deliberately create an administrative individual without natural loot eligibility.
func=BP/'functions/mycology';func.mkdir(parents=True,exist_ok=True)
(func/'give_test.mcfunction').write_text('give @s minecraft:red_mushroom 64\ngive @s minecraft:brown_mushroom 64\nsummon pinene:mushroom_appraiser ~3 ~ ~\n',encoding='utf8')
(func/'give_catalog.mcfunction').write_text('\n'.join('give @s '+e['itemId']+' 1' for e in E+N)+'\n',encoding='utf8')
# Compact catalog page per specimen.
status={'food_recorded':'食用として扱う資料あり（生食の安全を示さない）','toxic':'有毒','unknown':'不明／判断しない','conditional':'中毒報告あり・条件付き','inedible':'食料に不適'}
lines=['# 菌類図鑑本文 v1.2.0-handoff','',D['warningJa'],'','**以下のジョークは架空の鑑定士の発言。科学解説ではない。**','']
for e in E:
 lines += [f"## {e['id']}　{e['nameJa']}　★{e['rarity']}",f"採用学名：*{e['scientificName']}*",f"現実の扱い：{status[e['realWorldStatus']]}",'', '**科学解説**  '+e['scienceJa'],'','**ゲーム内表現**  '+e['gameExplanationJa'],'','**鑑定士のひとこと**  「'+e['jokeJa']+'」','']
 if e['taxonomyNote']:lines+=['**命名上の注記**  '+e['taxonomyNote'],'']
 lines+=['**資料**  '+' / '.join('['+sid+'] '+S[sid]['url'] for sid in e['sourceIds']),'']
(ROOT/'docs/SCIENCE_CODEX.md').write_text('\n'.join(lines),encoding='utf8')
with (ROOT/'data/probabilities.csv').open('w',encoding='utf-8-sig',newline='') as f:
 w=csv.writer(f);w.writerow(['id','name_ja','group','rarity','weight','group_weight_sum','probability_per_draw','mean_draws_per_hit'])
 for e in E:
  total=sum(2**(10-x['rarity']) for x in E if x['group']==e['group']);wt=2**(10-e['rarity'])
  w.writerow([e['id'],e['nameJa'],e['group'],e['rarity'],wt,total,format(wt/total,'.12g'),format(total/wt,'.12g')])
print('Built item definitions, registry, localization, NPC BP, manifests, science codex')

from build_field_guide import build_guide
build_guide()
