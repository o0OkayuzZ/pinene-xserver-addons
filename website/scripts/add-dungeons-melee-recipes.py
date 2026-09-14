"""Add melee recipes from pinned Git objects; game working trees remain untouched."""
import json,subprocess
from pathlib import Path
from collections import Counter
from functools import lru_cache
web=Path(__file__).resolve().parents[1];repo=web.parent
revision='3b66fddebe8006ea5f3656d509bf833d7594a09f'
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
@lru_cache(None)
def source(path):return json.loads(git('show',revision+':'+path).decode('utf-8-sig'))
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
tree=set(git('ls-tree','-r','--name-only',revision).decode('utf-8').splitlines())
bp=next(p.rsplit('/',1)[0] for p in tree if p.startswith('behavior_packs/bp_08_') and p.endswith('/manifest.json'))
rp=next(p.rsplit('/',1)[0] for p in tree if p.startswith('resource_packs/rp_06_') and p.endswith('/manifest.json'))
assert not git("diff","--name-only","4a948e25ad9930a4a0667c093de670230bf3d9fc",revision,"--",bp,rp), "Review changed pack sources first"
records=read(web/'src/data/field-guide.json'); groups=read(web/'src/data/dungeons-guide.json')
assert not any(g['id']=='melee-recipes' for g in groups), 'Already applied'
langpath=rp+'/texts/ja_JP.lang'
lang=dict(line.split('=',1) for line in git('show',revision+':'+langpath).decode('utf-8').splitlines() if '=' in line)
import re
def label(identifier):
    if identifier.startswith('dungeons:'):
        value=lang.get('item.'+identifier) or lang.get('item.'+identifier+'.name');assert value,identifier
        return re.sub(r'[\ue000-\uf8ff]','',re.sub(r'§.','',value)).strip()
    return {'magma':'マグマブロック','lapis_lazuli':'ラピスラズリ','string':'糸','crossbow':'クロスボウ（バニラ）','iron_nugget':'\u9244\u584a','stick':'\u68d2','iron_ingot':'鉄インゴット'}[identifier.removeprefix('minecraft:')]
byid={e['id']:e for e in records};group=dict(id='melee-recipes',title='近接武器のレシピ',intro='素材からの製作3件と、同じ装備を材料に使う設計図レシピ49件を区別して掲載。',entries=[])
recipe_paths=[]
for path in sorted(p for p in tree if p.startswith(bp+'/recipes/weapon/') and p.endswith('.json')):
    raw=source(path);kind=next(k for k in raw if k.startswith('minecraft:recipe_'));r=raw[kind]
    outputs=r['result'] if isinstance(r['result'],list) else [r['result']]
    assert all(o['item']==outputs[0]['item'] for o in outputs),path
    target_id='dungeons-'+outputs[0]['item'].split(':')[1].replace('_','-')
    if outputs[0]['item']=='dungeons:hawkbrand':target_id='hawkbrand'
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
assert len(group['entries'])==52,len(group['entries'])

group['title']='\u8fd1\u63a5\u6b66\u5668\u306e\u30ec\u30b7\u30d4'
groups.insert(next(i for i,g in enumerate(groups) if g['id']=='melee')+1,group)
for path,data in [(web/'src/data/field-guide.json',records),(web/'src/data/dungeons-guide.json',groups)]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(web/'artifacts/dungeons-melee-recipes-audit.json').write_text(json.dumps(dict(sourceCommit=revision,unchangedSince='4a948e25ad9930a4a0667c093de670230bf3d9fc',addedRecipePaths=recipe_paths),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Added',len(group['entries']),'Total',len(records))
