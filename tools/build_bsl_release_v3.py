"""Reproducible BSL v3: bounded total draws, exact rare odds, protected progression."""
from __future__ import annotations
import argparse, copy, json, math, subprocess
from fractions import Fraction
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
UUID='423276b9-02f5-4082-911a-c631a2d83d12'
SOURCE='e26a76228034edf5d322149be1115b938492aaa0'
PROFILE_TOTALS={'Early':(15,19),'Mid':(16,20),'High':(17,22),'End':(18,23)}
def load(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def pack():
    paths=[p.parent for p in ROOT.glob('behavior_packs/*/manifest.json') if load(p)['header']['uuid']==UUID]
    assert len(paths)==1, paths
    return paths[0]
def original(rel):
    p=pack()/rel
    return json.loads(subprocess.check_output(['git','show',SOURCE+':'+p.relative_to(ROOT).as_posix()],cwd=ROOT))
def ref(name,weight=1): return {'type':'loot_table','name':name,'weight':weight}
def replacement(pool,fallback):
    assert pool.get('rolls')==1 and set(pool)<={'rolls','entries','conditions'}
    chance=Fraction(1)
    for c in pool.get('conditions',[]):
        assert set(c)=={'condition','chance'} and c['condition']=='random_chance'
        chance*=Fraction(str(c['chance']))
    assert 0<=chance<=1
    entries=pool['entries']; total=sum(e.get('weight',1) for e in entries)
    assert total>0 and not any(e.get('conditions') for e in entries)
    pairs=[]; miss=1-chance
    for entry in entries:
        probability=chance*Fraction(entry.get('weight',1),total)
        if entry['type']=='empty': miss+=probability
        else: pairs.append((copy.deepcopy(entry),probability))
    if miss: pairs.append((ref(fallback),miss))
    denominator=math.lcm(*(p.denominator for _,p in pairs))
    result=[]
    for entry,p in pairs:
        if not p: continue
        entry['weight']=int(p*denominator); result.append(entry)
    divisor=math.gcd(*(e['weight'] for e in result))
    for e in result: e['weight']//=divisor
    assert max(e['weight'] for e in result)<2**31
    return {'rolls':1,'entries':result}
def outputs():
    result={}; profiles=load(ROOT/'docs/bsl/provenance.json')['profiles']
    for name,info in profiles.items():
        if info['profile']=='Special': continue
        old=original('loot_tables/chests/'+name); pools=old['pools']
        helper='loot_tables/bsl_v3/normal/'+name
        base=copy.deepcopy(pools[0]); base['rolls']=1; result[helper]={'pools':[base]}
        reserves=[replacement(p,helper) for p in pools[1:]]
        low,high=PROFILE_TOTALS[info['profile']]; low-=len(reserves); high-=len(reserves)
        assert 1<=low<=high
        primary=copy.deepcopy(base); primary['rolls']={'min':low,'max':high}
        result['loot_tables/chests/'+name]={'pools':[primary,*reserves]}
    for filename,resource_rolls,gear_rolls in [('bastion_treasure.json',4,6),('buriedtreasure.json',4,4)]:
        old=original('loot_tables/chests/'+filename); pools=old['pools']; helper='loot_tables/bsl_v3/special/'+filename
        resource=copy.deepcopy(pools[10]); resource['rolls']=1
        result[helper]={'pools':[resource]}
        anchors=copy.deepcopy(pools[:10]); gear=copy.deepcopy(pools[11]); gear['rolls']=gear_rolls
        if filename=='bastion_treasure.json':
            assert anchors[0]['entries'][0]['name']=='minecraft:netherite_upgrade_smithing_template'
            spear=copy.deepcopy(anchors[0]['entries'][1]); assert spear['name']=='minecraft:diamond_spear'
            spear['weight']=6; gear['entries'].append(spear)
            anchors[0]['entries']=anchors[0]['entries'][:1]
            anchors[1]=replacement(anchors[1],helper)
        ordinary=copy.deepcopy(resource); ordinary['rolls']=resource_rolls
        rares=[replacement(p,helper) for p in pools[12:]]
        result['loot_tables/chests/'+filename]={'pools':[*anchors,ordinary,gear,*rares]}
    from build_bsl_icebox_jackpot import build as build_icebox
    result['loot_tables/chests/ancient_city_ice_box.json']=build_icebox(pack())
    return result
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--write',action='store_true'); args=parser.parse_args()
    result=outputs(); changed=[]
    for rel,data in result.items():
        dest=pack()/rel
        if not dest.exists() or load(dest)!=data:
            changed.append(rel)
            if args.write:
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'generated':len(result),'changes':changed,'written':args.write},ensure_ascii=True))
    if changed and not args.write: raise SystemExit(1)
