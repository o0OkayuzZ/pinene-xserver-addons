"""Independent contract, probability and capacity checks for released BSL v3."""
import argparse,copy,hashlib,json,math,random,subprocess
from fractions import Fraction
from pathlib import Path
from build_bsl_release_v3 import ROOT,SOURCE,pack,load,original,outputs
EXPECTED={'Early':(15,19),'Mid':(16,20),'High':(17,22),'End':(18,23)}
def walk(x):
    if isinstance(x,dict):
        yield x
        for v in x.values(): yield from walk(v)
    elif isinstance(x,list):
        for v in x: yield from walk(v)
def interval(value):
    if type(value) is int: return value,value
    assert isinstance(value,dict) and set(value)=={'min','max'},value
    lo,hi=value['min'],value['max']; assert type(lo)==type(hi)==int and 1<=lo<=hi
    return lo,hi
def odds(pool):
    chance=Fraction(1)
    for c in pool.get('conditions',[]):
        assert c['condition']=='random_chance'; chance*=Fraction(str(c['chance']))
    total=sum(e.get('weight',1) for e in pool['entries']); result={}
    for e in pool['entries']:
        if e['type']=='empty': continue
        data=copy.deepcopy(e); data.pop('weight',None); key=json.dumps(data,sort_keys=True)
        result[key]=result.get(key,Fraction())+chance*Fraction(e.get('weight',1),total)
    return result
def bound(data,bp,limits,chain=()):
    low=high=0
    for pool in data['pools']:
        assert set(pool)=={'rolls','entries'},'Conditional/bonus pool not covered'
        lo,hi=interval(pool['rolls']); entries=[]
        for e in pool['entries']:
            assert e.get('weight',1)>0 and not e.get('conditions')
            if e['type']=='loot_table':
                name=e['name']; assert name not in chain and '..' not in Path(name).parts
                entries.append(bound(load(bp/name),bp,limits,(*chain,name)))
            else:
                assert e['type']=='item','Empty entry wastes a reserved slot'
                functions=e.get('functions',[]); count=1
                for f in functions:
                    if f['function'].split(':')[-1]=='set_count':
                        assert not f.get('add',False); count=f['count']
                a,b=interval(count); maximum=limits.get(e['name'])
                if maximum is not None: assert b<=maximum,(e['name'],b,maximum)
                entries.append((1,1))
        assert entries
        low+=lo*min(x[0] for x in entries); high+=hi*max(x[1] for x in entries)
    return low,high
def guaranteed(data,item):
    return any(p.get('rolls')==1 and set(p)=={'rolls','entries'} and len(p['entries'])==1
               and p['entries'][0].get('type')=='item' and p['entries'][0].get('name')==item for p in data['pools'])
def validate(native_limits=None):
    bp=pack(); tables=outputs(); profiles=load(ROOT/'docs/bsl/provenance.json')['profiles']
    for rel,data in tables.items(): assert load(bp/rel)==data,('generator drift',rel)
    limits=load(native_limits) if native_limits else {}
    results={}; checked_odds=0; ids=set()
    for name,info in profiles.items():
        current=load(bp/'loot_tables/chests'/name); before=original('loot_tables/chests/'+name)
        target=(27,27) if info['profile']=='Special' else EXPECTED[info['profile']]
        actual=bound(current,bp,limits); assert actual==target,(name,actual,target)
        results[name]={'profile':info['profile'],'generatedStackBounds':list(actual)}
        if info['profile']!='Special':
            assert current['pools'][0]['entries']==before['pools'][0]['entries'],('ordinary rewards changed',name)
            assert len(current['pools'])==len(before['pools'])
            for old,new in zip(before['pools'][1:],current['pools'][1:]):
                for key,chance in odds(old).items(): assert odds(new)[key]==chance,(name,key)
                checked_odds+=1
        elif name!='ancient_city_ice_box.json':
            item='minecraft:heart_of_the_sea' if name=='buriedtreasure.json' else 'minecraft:netherite_upgrade_smithing_template'
            assert guaranteed(current,item),(name,'progression is not guaranteed')
            for old,new in zip(before['pools'][12:],current['pools'][12:]):
                for key,chance in odds(old).items(): assert odds(new)[key]==chance,(name,key)
                checked_odds+=1
            for i in range(2 if name=='bastion_treasure.json' else 1,10): assert current['pools'][i]==before['pools'][i]
            if name=='bastion_treasure.json':
                for key,chance in odds(before['pools'][1]).items(): assert odds(current['pools'][1])[key]==chance
    for data in tables.values():
        ids.update(n['name'] for n in walk(data) if n.get('type')=='item')
    if native_limits: assert ids<=set(limits),('missing native item types',ids-set(limits))
    from validate_bsl_icebox_jackpot import validate as icebox_validate
    icebox=icebox_validate()
    for p in list((bp/'loot_tables/bsl').rglob('*.json'))+list((bp/'loot_tables/chests/infinite_castle').rglob('*.json')):
        assert load(p)==original(p.relative_to(bp).as_posix()),('common/castle changed',str(p))
    # Keep content-specific exclusions; never introduce a universal reward grab-bag.
    for name in profiles:
        nodes=list(walk(load(bp/'loot_tables/chests'/name)))
        names={n.get('name') for n in nodes if n.get('type')=='item'}
        assert 'waystone:waystone' not in names
        if 'trial_chambers/' in name: assert not names & {'minecraft:mace','minecraft:heavy_core'}
        if name=='end_city_treasure.json': assert 'minecraft:dragon_egg' not in names
        assert not any(str(n).startswith('dungeons:') for n in names)
    return {'status':'PASS','source':SOURCE,'normalTables':33,'specialTables':3,
            'rarePoolsChecked':checked_odds,'nativeItemLimitsUsed':bool(native_limits),
            'tables':results,'icebox':icebox}
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--native-items',type=Path); parser.add_argument('--report',type=Path)
    args=parser.parse_args(); report=validate(args.native_items)
    if args.report: args.report.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({k:v for k,v in report.items() if k!='tables'},ensure_ascii=True))
