"""Audit pinned Git objects and add ranged recipes; game working trees remain untouched."""
import json,subprocess,copy
from pathlib import Path
from collections import Counter
from functools import lru_cache
web=Path(__file__).resolve().parents[1];repo=web.parent
base='aea85120954a8b74033b86253c17a04b691dab21'
revision='4a948e25ad9930a4a0667c093de670230bf3d9fc'
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
@lru_cache(None)
def source(path):return json.loads(git('show',revision+':'+path).decode('utf-8-sig'))
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
tree=set(git('ls-tree','-r','--name-only',revision).decode('utf-8').splitlines())
bp=next(p.rsplit('/',1)[0] for p in tree if p.startswith('behavior_packs/bp_08_') and p.endswith('/manifest.json'))
rp=next(p.rsplit('/',1)[0] for p in tree if p.startswith('resource_packs/rp_06_') and p.endswith('/manifest.json'))
records=read(web/'src/data/field-guide.json');contents=read(web/'src/data/content-registry.json')
groups=read(web/'src/data/dungeons-guide.json');packs=read(web/'src/data/pack-registry.json')
assert not any(g['id']=='ranged-recipes' for g in groups),'Batch already applied'
changed=set(git('diff','--name-only',base,revision).decode('utf-8').splitlines())
content=next(c for c in contents['contents'] if c['id']=='minecraft-dungeons')
used={p for e in [*filter(lambda e:e['contentId']=='minecraft-dungeons',records),content] for p in e['evidence']['paths']}
assert used<=tree
checked=[]
for path in sorted(used&changed):
    old=json.loads(git('show',base+':'+path).decode('utf-8-sig'));new=source(path)
    if '/loot_tables/chests/diamond_chest/' in path:
        expected=copy.deepcopy(old)
        for pool in expected['pools']:pool['entries']=[e for e in pool['entries'] if e.get('name')!='waystone:waystone']
        assert expected==new,path
    elif path in [bp+'/manifest.json',rp+'/manifest.json']:
        assert old['header']['uuid']==new['header']['uuid'] and new['header']['version']==[2,0,6]
    else:raise AssertionError('Unreviewed evidence change: '+path)
    checked.append(path)
# Ensure all newly used source directories are unchanged, before using current evidence.
for prefix in [bp+'/items/',bp+'/recipes/',rp+'/textures/',rp+'/texts/']:
    assert not any(p.startswith(prefix) for p in changed),prefix
for entry in records:
    if entry['contentId']=='minecraft-dungeons':entry['evidence']['commit']=revision
content['evidence']['commit']=revision
content['evidence']['paths'].append('docs/deployments/2026-09-12-release.md')
for v in content['verification']:
    if v['result']=='confirmed':v['commit']=revision
# Refresh selected pack versions/registration facts, without asserting gameplay status.
registrations={kind:source('world_'+kind+'_packs.json') for kind in ['behavior','resource']}
pack_changes=[]
for pack in packs['packs']:
    paths=[p for p in tree if p.startswith(pack['kind']+'_packs/') and p.endswith('/manifest.json') and p.count('/')==2]
    matches=[(p,source(p)['header']) for p in paths if source(p)['header']['uuid']==pack['uuid']]
    assert len(matches)==1,pack['uuid']
    path,h=matches[0];version='.'.join(map(str,h['version']))
    registered=any(r['pack_id']==h['uuid'] and r['version']==h['version'] for r in registrations[pack['kind']])
    if (version,registered)!=(pack['version'],pack['registered']):pack_changes.append({'uuid':pack['uuid'],'old':pack['version'],'new':version,'registered':registered})
    pack.update(version=version,registered=registered)
packs['source_commit']=revision

langpath=rp+'/texts/ja_JP.lang'
lang=dict(line.split('=',1) for line in git('show',revision+':'+langpath).decode('utf-8').splitlines() if '=' in line)
import re
def label(identifier):
    if identifier.startswith('dungeons:'):
        value=lang.get('item.'+identifier) or lang.get('item.'+identifier+'.name');assert value,identifier
        return re.sub(r'[\ue000-\uf8ff]','',re.sub(r'§.','',value)).strip()
    return {'magma':'マグマブロック','lapis_lazuli':'ラピスラズリ','string':'糸','crossbow':'クロスボウ（バニラ）','iron_ingot':'鉄インゴット'}[identifier.removeprefix('minecraft:')]
byid={e['id']:e for e in records};group=dict(id='ranged-recipes',title='弓・クロスボウのレシピ',intro='素材からの製作と、同じ装備を材料に使う設計図レシピを区別して掲載。',entries=[])
recipe_paths=[]
for path in sorted(p for p in tree if p.startswith(bp+'/recipes/ranged/') and p.endswith('.json')):
    raw=source(path);kind=next(k for k in raw if k.startswith('minecraft:recipe_'));r=raw[kind]
    outputs=r['result'] if isinstance(r['result'],list) else [r['result']]
    assert all(o['item']==outputs[0]['item'] for o in outputs),path
    target_id='dungeons-'+outputs[0]['item'].split(':')[1].replace('_','-')
    if target_id not in byid:continue
    target=byid[target_id];assert target['kind']=='item' and target['visibility']=='public' and r['tags']==['crafting_table']
    shaped=kind=='minecraft:recipe_shaped';blueprint=isinstance(r['result'],list)
    if shaped:
        keys={k:label(v['item']) for k,v in r['key'].items()};assert all(set(v)=={'item'} for v in r['key'].values())
        assert all(c==' ' or c in keys for row in r['pattern'] for c in row)
        grid=[[keys.get(c,'') for c in row] for row in r['pattern']];counts=Counter(x for row in grid for x in row if x)
    else:
        grid=[];counts=Counter()
        for ingredient in r['ingredients']:counts[label(ingredient['item'])]+=ingredient.get('count',1)
    count=sum(o.get('count',1) for o in outputs)
    if blueprint:
        assert len(outputs)==2 and count==2
        assert sorted(v['item'] for v in r['key'].values())==sorted(['dungeons:blue_print',outputs[0]['item']])
        title=target['name']+'の設計図レシピ'
        description='青色の設計図1枚と、同じ装備1個を材料に使うレシピです。結果欄には同じ装備が1個ずつ2枠、合計2個登録されています。'
        details=['元になる装備が必要です。素材だけから初めて入手するためのレシピではありません。','結果欄の2枠を合計して表示しています。耐久値・エンチャントの引き継ぎや実際の製作結果は未検証です。']
    else:
        title=target['name']+'のレシピ';description='作業台で材料から製作するレシピです。材料の個数、配置の有無と完成数を確認できます。';details=[]
    slug=target_id+('-blueprint-recipe' if blueprint else '-recipe');assert slug not in byid
    entry=dict(id=slug,name=title,kind='recipe',contentId='minecraft-dungeons',summary=('同じ装備と青色の設計図を使うレシピ。' if blueprint else target['name']+'を作る材料と配置。'),description=description,
       usage='作業台で、'+('下の配置どおりに材料を並べます。' if shaped else '材料を配置自由に組み合わせます。'),
       obtaining='最新版リポジトリのレシピ定義を照合しています。実際の製作・解放表示は未検証です。',details=details,image=None,
       recipe=dict(shaped=shaped,grid=grid,ingredients=[dict(name=k,count=v) for k,v in counts.items()],resultId=target_id,count=count),
       visibility='public',evidence=dict(commit=revision,paths=[path,langpath,*target['evidence']['paths'][:1]]))
    records.append(entry);byid[slug]=entry;group['entries'].append(slug);recipe_paths.append(path)
    target['obtaining']+=(' 同じ装備1個と青色の設計図を使うレシピを掲載しています。' if blueprint else ' 作業台で製作するレシピもあります。')
    target['evidence']['paths'].append(path)
assert len(group['entries'])==32,len(group['entries'])
groups.insert(next(i for i,g in enumerate(groups) if g['id']=='ranged')+1,group)
content['highlights'].append('遠距離装備の製作3件と、元の装備が必要な設計図レシピ29件。')
for path,data in [(web/'src/data/field-guide.json',records),(web/'src/data/dungeons-guide.json',groups),(web/'src/data/content-registry.json',contents),(web/'src/data/pack-registry.json',packs)]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(web/'artifacts/dungeons-latest-audit.json').write_text(json.dumps(dict(sourceCommit=revision,previousCommit=base,reviewedChangedEvidence=checked,packChanges=pack_changes,addedRecipePaths=recipe_paths),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Latest source:',revision,'Added:',len(group['entries']),'Total:',len(records),'Pack changes:',len(pack_changes))
