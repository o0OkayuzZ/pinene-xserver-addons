"""Generate Infinite Castle tables from BSL_weighted_rebalance_v2_spec.md.

Normal structure BSL and V3 recovery tables are deliberately not rewritten.
"""
from pathlib import Path
import json, math, re

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT/'behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12'
PREFIX = 'chests/infinite_castle/v4/'
SCALE = 10_000_000
TARGETS = {
 'fossil': [.20,.45,.80], 'stem_cell':[.12,.35,.70],
 'enchanted_food':[.15,.50,.90], 'netherite':[.015,.15,.40],
 'deathnerite':[.01,.12,.35], 'deathnerite_block':[.0005,.01,.03],
 'enchanted_apple':[.005,.05,.15], 'collectible':[.025,.08,.20],
 'warpstone':[.0075,.015,.04], 'blue_apple':[.003,.006,.012],
 'trim':[.003,.015,.04], 'upgrade':[.001,.005,.015], 'parcanite':[.0003,.0015,.005],
}
def item(name, weight=1, count=None):
 e={'type':'item','name':name if ':' in name else 'minecraft:'+name,'weight':weight}
 if count is not None:e['functions']=[{'function':'set_count','count':{'min':count[0],'max':count[1]}}]
 return e
def ref(name,weight=1):return {'type':'loot_table','name':'loot_tables/'+name+'.json','weight':weight}
def table(entries):return {'pools':[{'rolls':1,'entries':entries}]}
def build():
 out={};audit={}
 def put(name,entries):out[name+'.json']=table(entries)
 reg=(ROOT/'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/mycology/registry.js').read_text(encoding='utf-8')
 species=json.loads(re.search(r'export const MUSHROOMS = (.*);',reg).group(1))
 for group in ['red','brown']:
  put(PREFIX+'mycology_'+group,[item(d['itemId'],2**(10-d['rarity'])) for d in species if d['group']==group])
 put(PREFIX+'mycology',[ref(PREFIX+'mycology_red'),ref(PREFIX+'mycology_brown')])
 # Fossils have their own target; do not accidentally add them through collectibles.
 groups=[]
 for group,w in [('common',70),('rare',25),('special',5)]:
  entries=json.loads((BP/f'loot_tables/bsl/collectibles/{group}.json').read_text())['pools'][0]['entries']
  entries=[e for e in entries if e['name']!='myname:mystery_fossil']
  put(PREFIX+'collectibles_'+group,entries);groups.append(ref(PREFIX+'collectibles_'+group,w))
 put(PREFIX+'collectibles',groups)
 trims=['sentry','dune','coast','wild','ward','eye','vex','tide','snout','rib','spire','wayfinder','shaper','silence','raiser','host','flow','bolt']
 put(PREFIX+'trims',[item(t+'_armor_trim_smithing_template') for t in trims])
 themes={
 'guard':[item('iron_ingot',30,(2,6)),item('arrow',25,(4,12)),item('gold_ingot',20,(5,12)),item('diamond',10,(1,2)),item('emerald',15,(1,3))],
 'curse':[item('experience_bottle',30,(2,6)),item('lapis_lazuli',25,(3,10)),item('ghast_tear',15,(1,2)),ref('bsl/food/golden_foods',20),ref(PREFIX+'potions_curse',10)],
 'wraith':[item('echo_shard',45,(1,3)),item('ender_pearl',20,(1,2)),item('phantom_membrane',15,(1,3)),item('experience_bottle',15,(2,6)),ref(PREFIX+'potions_wraith',5)],
 'heavy':[item('gold_block',30,(1,3)),item('diamond',25,(1,3)),item('ancient_debris',20,(1,2)),item('netherite_scrap',20,(1,2)),ref(PREFIX+'potions_heavy',5)],
 }
 effects=['strong_healing','strong_regeneration','strong_strength','strong_swiftness','strong_leaping','strong_poison','strong_harming','strong_slowness','strong_turtle_master','long_fire_resistance','long_nightvision','long_water_breathing','long_invisibility','long_weakness','long_slow_falling']
 favored={'guard':['strong_healing','strong_strength','strong_swiftness'], 'curse':['strong_poison','strong_harming','long_weakness'], 'wraith':['long_nightvision','long_invisibility','strong_regeneration'], 'heavy':['strong_turtle_master','long_fire_resistance','strong_strength']}
 for kind in ['guard','curse','wraith','heavy','mixed','elite','treasure_vault']:
  potions=[]
  for form,fw in [('potion',50),('splash_potion',35),('lingering_potion',15)]:
   for effect in effects:
    e=item(form,fw*(4 if effect in favored.get(kind,[]) else 1));e['functions']=[{'function':'set_potion','id':effect}];potions.append(e)
  put(PREFIX+'potions_'+kind,potions)
 for kind,entries in themes.items():put(PREFIX+'theme_'+kind,entries)
 for kind in ['mixed','elite','treasure_vault']:put(PREFIX+'theme_'+kind,[ref(PREFIX+'theme_'+t) for t in themes])
 rare_entries={
 'fossil':item('myname:mystery_fossil'), 'stem_cell':item('pinematerials:zonbikansaibou'),
 'enchanted_food':ref('bsl/food/enchanted_golden_foods'), 'netherite':item('netherite_ingot'),
 'deathnerite':item('true_dn:deathnerite_ingot'), 'deathnerite_block':item('true_dn:deathnerite_block'),
 'enchanted_apple':item('enchanted_golden_apple'), 'collectible':ref(PREFIX+'collectibles'),
 'warpstone':item('ws:warpstone'), 'blue_apple':item('resetapple:blue_apple'),
 'trim':ref(PREFIX+'trims'), 'upgrade':item('netherite_upgrade_smithing_template'),
 'parcanite':item('true_dn:darkness_upgrade_smithing_template'),
 }
 for kind in ['guard','curse','wraith','heavy','mixed','elite','treasure_vault']:
  tier=1 if kind=='elite' else 2 if kind=='treasure_vault' else 0
  lo,hi=[(16,20),(19,23),(23,27)][tier];mean=(lo+hi)/2
  targets={k:v[tier] for k,v in TARGETS.items()}
  if kind=='guard':targets['stem_cell']=.15
  if kind=='curse':targets['enchanted_food']=.20
  if kind=='heavy':targets.update(netherite=.04,deathnerite=.04)
  if kind=='mixed':targets['deathnerite']=.015
  entries=[];rates={}
  for name,p in targets.items():
   q=1-(1-p)**(1/mean);w=round(q*SCALE)
   entries.append({**rare_entries[name],'weight':w})
   rates[name]={'target':p,'weight':w,'actual':sum(1-(1-w/SCALE)**n for n in range(lo,hi+1))/(hi-lo+1)}
  remaining=SCALE-sum(e['weight'] for e in entries)
  common=[item('red_mushroom',13,(1,10)),item('brown_mushroom',13,(1,10)),item('rotten_flesh',18,(1,2)),ref('bsl/food/pancakes',11),item('gold_ingot',13,(5,12)),item('gold_block',7,(1,3)),ref(PREFIX+'mycology',4),ref(PREFIX+'potions_'+kind,7),ref(PREFIX+'theme_'+kind,14)]
  for e in common:e['weight']=round(remaining*e['weight']/100)
  common[-1]['weight']+=remaining-sum(e['weight'] for e in common)
  put(f'chests/infinite_castle/slots/{kind}_v4',entries+common)
  audit[kind]={'slots':[lo,hi],'rare':rates,'commonWeight':remaining}
 return out,audit
if __name__=='__main__':
 out,audit=build()
 for name,data in out.items():
  p=BP/'loot_tables'/name;p.parent.mkdir(parents=True,exist_ok=True)
  p.write_bytes((json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode())
 p=ROOT/'docs/bsl/castle-v4-probabilities.json';p.write_bytes((json.dumps(audit,indent=2)+'\n').encode())
 print(f'Generated {len(out)} non-empty V4 tables; normal structure tables unchanged.')
