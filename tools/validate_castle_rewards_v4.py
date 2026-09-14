"""Validate exact slot tables, active IDs, Mycology weights and 70k chest draws."""
from pathlib import Path
import json,random,math,re,bisect
from build_castle_rewards_v4 import ROOT,BP,build,SCALE,PREFIX
out,audit=build()
ids=set()
for pack in (ROOT/'behavior_packs').iterdir():
 for folder in ['items','blocks']:
  for p in (pack/folder).rglob('*.json'):
   try:d=json.loads(p.read_text(encoding='utf-8-sig'))
   except (ValueError,UnicodeError):continue
   for key in ['minecraft:item','minecraft:block']:
    if key in d:ids.add(d[key]['description']['identifier'])
visited=set()
def check(name,parents=()):
 assert name not in parents,('cycle',name)
 if name in visited:return
 p=BP/'loot_tables'/name
 d=json.loads(p.read_text(encoding='utf-8-sig'))
 assert len(d['pools'])==1 and d['pools'][0]['rolls']==1,name
 pool=d['pools'][0];assert not pool.get('conditions'),name
 for e in pool['entries']:
  assert e['type']!='empty' and not e.get('conditions') and e.get('weight',1)>0,(name,e)
  if e['type']=='loot_table':check(e['name'].removeprefix('loot_tables/'),(*parents,name))
  else:
   assert e['type']=='item'
   assert e['name'].startswith('minecraft:') or e['name'] in ids,(name,e['name'])
 visited.add(name)
for name,data in out.items():
 assert json.loads((BP/'loot_tables'/name).read_text())==data,('generated drift',name)
 check(name)
rng=random.Random(420320);results={}
for kind,a in audit.items():
 entries=out[f'chests/infinite_castle/slots/{kind}_v4.json']['pools'][0]['entries']
 assert sum(e['weight'] for e in entries)==SCALE
 keys=list(a['rare']);counts={k:0 for k in keys};total=0
 cdf=[];v=0
 for e in entries:v+=e['weight'];cdf.append(v)
 for _ in range(10000):
  n=rng.randint(*a['slots']);total+=n
  hits={bisect.bisect_right(cdf,rng.randrange(SCALE)) for _ in range(n)}
  for i,k in enumerate(keys):counts[k]+=i in hits
 observed={k:counts[k]/10000 for k in keys}
 for k,p in observed.items():
  want=a['rare'][k]['actual'];assert abs(p-want)<6*math.sqrt(want*(1-want)/10000)+.0005,(kind,k,p,want)
 results[kind]={'chests':10000,'meanOccupiedSlots':total/10000,'observedRare':observed}
 # Potion physical form weights are independent of theme effects.
 forms={}
 for e in out[PREFIX+'potions_'+kind+'.json']['pools'][0]['entries']:forms[e['name']]=forms.get(e['name'],0)+e['weight']
 totalforms=sum(forms.values())
 assert [forms['minecraft:'+f]/totalforms for f in ['potion','splash_potion','lingering_potion']]==[.5,.35,.15]
text=json.dumps({'tables':len(out),'nestedTablesValidated':len(visited),'simulation':results},indent=2)
(ROOT/'docs/bsl/castle-v4-validation.json').write_bytes((text+'\n').encode())
print(f'PASS: {len(out)} generated tables, {len(visited)} nested tables, active custom IDs, 70000 chests, potion forms 50/35/15.')
