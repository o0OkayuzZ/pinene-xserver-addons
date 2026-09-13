"""Validate full weighted BSL release against the pre-rebalance source."""
from pathlib import Path
import json,subprocess,hashlib,math,random,re,bisect,sys
sys.dont_write_bytecode=True
from build_bsl_weighted_rebalance import ROOT,BP,CHESTS,BASELINE,PROFILE_ROLLS,SPECIAL

load=lambda p:json.loads(p.read_text(encoding='utf-8-sig'))
def original(p):return json.loads(subprocess.check_output(['git','show',BASELINE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT))
def walk(x):
 if isinstance(x,dict):
  yield x
  for v in x.values():yield from walk(v)
 elif isinstance(x,list):
  for v in x:yield from walk(v)
profiles=load(ROOT/'docs/bsl/provenance.json')['profiles'];rng=random.Random(20260913)
manifest=load(BP/'manifest.json')
assert manifest['header']['version']==[1,0,19]
assert all(m['version']==[1,0,19] for m in manifest['modules'])
for p in [ROOT/'world_behavior_packs.json',ROOT/'worlds/Bedrock level/world_behavior_packs.json']:
 assert next(r['version'] for r in load(p) if r['pack_id']==manifest['header']['uuid'])==[1,0,19]
audit=load(ROOT/'docs/bsl/weighted-rebalance-v2.json');results={};representatives={}
for name,info in profiles.items():
 p=CHESTS/name;before=original(p);after=load(p);profile=info['profile']
 if profile=='Special':
  assert p.name in SPECIAL and before==after,(name,'special changed')
  assert p.read_bytes().replace(b'\r\n',b'\n')==subprocess.check_output(['git','show',BASELINE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT).replace(b'\r\n',b'\n')
  continue
 assert after['pools'][0]['rolls']==PROFILE_ROLLS[profile],name
 independent=set(info['independentChances']);preserved=[];ordinary=[]
 for pool in before['pools']:
  entries=[e for e in pool['entries'] if e['type']!='empty']
  special=entries and all(e.get('name') in independent for e in entries)
  unsupported=bool(pool.get('functions')) or any(e.get('conditions') for e in pool['entries']) or any(c['condition']!='random_chance' for c in pool.get('conditions',[]))
  if special or unsupported:preserved.append(pool);continue
  rolls=pool['rolls'];count=(rolls['min']+rolls['max'])/2 if isinstance(rolls,dict) else rolls
  for c in pool.get('conditions',[]):count*=c['chance']
  denom=sum(e.get('weight',1) for e in pool['entries'])
  ordinary.extend((e,count*e.get('weight',1)/denom) for e in entries)
 assert after['pools'][1:]==preserved,(name,'independent pool changed')
 new=after['pools'][0]['entries'];assert len(new)==len(ordinary)
 mass=sum(v for _,v in ordinary)
 for e,(old,contribution) in zip(new,ordinary):
  expected=json.loads(json.dumps(old));expected['weight']=max(1,round(contribution/mass*100000))
  for f in expected.get('functions',[]):
   if f.get('function')=='set_count':
    c=f['count'];f['count']={k:max(1,math.ceil(v/4)) for k,v in c.items()} if isinstance(c,dict) else max(1,math.ceil(c/4))
  assert e==expected,(name,'entry quantity/weight/metadata changed')
  assert e['type']!='empty'
 results[name]={'profile':profile,'baseDraws':after['pools'][0]['rolls'],'preservedPools':len(preserved)}
 representatives.setdefault(profile,(name,after))
# Existing Castle V3/V4 and common tables must be byte-equivalent to the release.
unchanged=0
for folder in [CHESTS/'infinite_castle',BP/'loot_tables/bsl']:
 for p in folder.rglob('*.json'):
  assert load(p)==original(p),(p,'castle/common table changed');unchanged+=1
active={x['pack_id'] for x in load(ROOT/'world_behavior_packs.json')}
packs=[p.parent for p in (ROOT/'behavior_packs').glob('*/manifest.json') if load(p)['header']['uuid'] in active]
ids=set();tables={};jsonc=0
for pack in packs:
 for folder,typ in [('items','minecraft:item'),('blocks','minecraft:block')]:
  for p in (pack/folder).rglob('*.json'):
   d=load(p).get(typ,{}).get('description',{}).get('identifier')
   if d:ids.add(d)
 for p in (pack/'loot_tables').rglob('*.json'):
  s=p.read_text(encoding='utf-8-sig')
  try:d=json.loads(s)
  except json.JSONDecodeError:
   assert pack!=BP
   s=re.sub(r'"(?:\\.|[^"\\])*"|//[^\n]*|/\*[\s\S]*?\*/',lambda m:m[0] if m[0].startswith('"') else '',s)
   d=json.loads(s);jsonc+=1
  tables[p]=d
graph={};references=0
for p,d in tables.items():
 graph[p]=[]
 for n in walk(d):
  if n.get('type')=='item':
   name=n['name'];assert name!='waystone:waystone',(p,name)
   assert ':' not in name or name.startswith('minecraft:') or name in ids,(p,'undefined',name)
  if n.get('type')=='loot_table':
   targets=[pack/n['name'] for pack in packs if pack/n['name'] in tables]
   assert targets or n['name']=='loot_tables/entities/raider_drops.json',(p,'missing',n['name'])
   graph[p].extend(targets);references+=1
seen=set()
def visit(p,stack=()):
 assert p not in stack,('cycle',p)
 if p in seen:return
 for q in graph[p]:visit(q,(*stack,p))
 seen.add(p)
for p in graph:visit(p)
simulations={}
for profile,(name,d) in representatives.items():
 pool=d['pools'][0];entries=pool['entries'];lo,hi=pool['rolls']['min'],pool['rolls']['max']
 cdf=[];total=0
 for e in entries:total+=e['weight'];cdf.append(total)
 hits=[0]*len(entries);draws=[]
 for _ in range(10000):
  count=rng.randint(lo,hi);draws.append(count)
  for _ in range(count):hits[bisect.bisect_right(cdf,rng.randrange(total))]+=1
 n=sum(draws)
 for count,e in zip(hits,entries):
  prob=e['weight']/total;assert abs(count/n-prob)<6*math.sqrt(prob*(1-prob)/n)+1/n
 assert set(draws)==set(range(lo,hi+1))
 simulations[profile]={'table':name,'chests':10000,'meanBaseDraws':n/10000,'physicalSlots':'not simulated; native merging/splitting requires game verification'}
report={'status':'PASS','baseline':BASELINE,'updatedTables':len(results),'specialUnchanged':sorted(SPECIAL),'castleAndCommonTablesUnchanged':unchanged,'activeLootTables':len(tables),'existingJSONC':jsonc,'nestedReferences':references,'simulations':simulations,'tables':results}
(ROOT/'docs/bsl/weighted-rebalance-v2-validation.json').write_bytes((json.dumps(report,indent=2)+'\n').encode())
assert len(results)==33 and len(simulations)==4
print(f'PASS: 33 rebuilt, 3 Special unchanged, {unchanged} Castle/common unchanged, {len(tables)} active loot tables, {references} references, 40000 simulated chests.')
