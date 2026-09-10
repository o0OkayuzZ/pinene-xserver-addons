"""One-time reviewed crafting expansion. Minecraft sources are read-only."""
import json, shutil
from pathlib import Path
web=Path(__file__).resolve().parents[1]; repo=web.parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
bp=next((repo/'behavior_packs').glob('bp_02_*'))
gear=next((repo/'behavior_packs').glob('bp_05_*'))
rp=next((repo/'resource_packs').glob('rp_05_*'))
file=web/'src/data/field-guide.json'; records=read(file); additions=[]
sha='aea85120954a8b74033b86253c17a04b691dab21'
names={}; targets={}
for entry in records:
    if entry['kind']!='item':continue
    for source in entry['evidence']['paths']:
        p=repo/source
        if '/items/' in source and p.suffix=='.json':
            d=read(p).get('minecraft:item')
            if d:targets[d['description']['identifier']]=entry
for p in (bp/'items').glob('*.json'):
    d=read(p)['minecraft:item'];names[d['description']['identifier']]=d['components']['minecraft:display_name']['value']
names.update({identifier:e['name'] for identifier,e in targets.items()})
names.update({'minecraft:gold_ingot':'金インゴット','minecraft:gold_block':'金ブロック','minecraft:book':'本','minecraft:gold_nugget':'金塊','minecraft:golden_carrot':'金のニンジン','minecraft:glistering_melon_slice':'きらめくスイカの薄切り','minecraft:poisonous_potato':'青くなったジャガイモ','minecraft:potato':'ジャガイモ','minecraft:pumpkin_pie':'パンプキンパイ','minecraft:apple':'リンゴ','minecraft:bowl':'ボウル','minecraft:milk_bucket':'ミルク入りバケツ','minecraft:wheat':'小麦','minecraft:stick':'棒','minecraft:netherite_ingot':'ネザライトインゴット'})
def add(slug,name,kind,owner,summary,description,usage,obtaining,details,paths,image=None,recipe=None):
    assert not any(e['id']==slug for e in records+additions),slug
    for p in paths:assert p.is_file(),p
    e=dict(id=slug,name=name,kind=kind,contentId=owner,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=recipe,visibility='public',evidence={'commit':sha,'paths':[p.relative_to(repo).as_posix() for p in paths]})
    additions.append(e);return e
table=rp/'textures/item_texture.json'
for stem in ['gwheat','egwheat']:
    p=bp/f'items/{stem}.json';d=read(p)['minecraft:item'];c=d['components'];identifier=d['description']['identifier'];slug='food-'+stem
    assert 'minecraft:food' not in c
    texture=read(table)['texture_data'][c['minecraft:icon']]['textures'];assert isinstance(texture,str)
    source=rp/(texture+'.png');assert source.is_file()
    shutil.copyfile(source,web/f'public/images/items/{slug}.png')
    enhanced=stem=='egwheat'
    e=add(slug,names[identifier],'item','golden-foods','金のパンを作るための小麦素材。' if not enhanced else 'エンチャントされた金のパンを作る小麦素材。','パンの作業台レシピで使用する素材です。アイテム自体には食料の設定がありません。','小麦素材を3個、作業台で横一列に並べてパンを作る設定です。','金の小麦を金ブロック8個で囲むレシピがあります。' if enhanced else '小麦を金インゴット8個で囲むレシピがあります。',['最大スタック数の設定：64。','素材そのものを食べる処理はありません。'],[p,bp/f'recipes/{stem}.json',bp/('recipes/egbread.json' if enhanced else 'recipes/gbread.json'),table,source],image={'src':f'/images/items/{slug}.png','alt':names[identifier]+'のパック内画像','kind':'pack-texture'})
    targets[identifier]=e
existing_paths={p for e in records if e['kind']=='recipe' for p in e['evidence']['paths']}
paths=list(sorted((bp/'recipes').glob('*.json')))+list(sorted((gear/'recipes/deathnerite_recipe/equipment').glob('*.json')))
for p in paths:
    if p.relative_to(repo).as_posix() in existing_paths:continue
    doc=read(p);key=next(k for k in doc if k.startswith('minecraft:recipe'))
    if key not in ['minecraft:recipe_shaped','minecraft:recipe_shapeless']:continue
    r=doc[key];identifier=r['result']['item']
    if identifier not in targets:continue
    target=targets[identifier];shaped=key.endswith('_shaped');assert r['tags']==['crafting_table']
    def label(ingredient):
        assert set(ingredient)<= {'item','count'}
        assert ingredient.get('count',1)==1
        return names[ingredient['item']]
    grid=[[label(r['key'][s]) if s!=' ' else '' for s in row] for row in r['pattern']] if shaped else []
    materials=[n for row in grid for n in row if n] if shaped else [label(i) for i in r['ingredients']]
    counts={n:materials.count(n) for n in dict.fromkeys(materials)}
    alternate=p.name=='egbread.json'
    slug='craft-'+target['id']+('-from-wheat' if alternate else '')
    name=target['name']+('のレシピ（小麦から）' if alternate else 'のレシピ')
    details=[] if 'count' in r['result'] else ['元のレシピでは完成数が省略されています。既定の1個として表示しています。']
    if alternate:details.append('金のパンを金ブロックで囲む既掲載レシピとは別の作業台レシピです。同じ完成品を作ります。')
    if identifier.startswith('true_dn:parcanite_'):details.append('作業台ではネザライトインゴットを使います。専用鍛冶台ではデスネライトインゴットを使う別の強化経路があります。')
    add(slug,name,'recipe',target['contentId'],('配置を合わせて' if shaped else '配置自由で')+target['name']+'を作る設定。','作業台用の定義から材料・配置・完成品を確認しました。','作業台で、下の材料を'+('配置表に合わせて並べます。' if shaped else '配置自由で組み合わせます。'),'材料の入手と本番でのクラフト動作は未確認です。',details,[p],recipe={'shaped':shaped,'grid':grid,'ingredients':[{'name':n,'count':c} for n,c in counts.items()],'resultId':target['id'],'count':r['result'].get('count',1)})
p=bp/'recipes/golden_foods_cook_golden_potato.json';r=read(p)['minecraft:recipe_furnace']
assert r['input']=='pinene:golden_potato' and r['output']=='pinene:baked_golden_potato'
assert r['tags']==['furnace','smoker','campfire','soul_campfire']
add('cooking-golden-potato','金のジャガイモの調理','feature','golden-foods','金のジャガイモを焼いて、ベイクド金ジャガイモへ。','調理用レシピには、金のジャガイモをベイクド金ジャガイモに変える定義があります。作業台の配置レシピとは別です。','かまど・燻製器・焚き火・魂の焚き火が対応先として登録されています。','材料は金のジャガイモです。金のジャガイモ自体には作業台レシピがあります。',['焼き時間・燃料消費量・獲得経験値は、この定義には記載がないため掲載していません。','各設備での実際の調理動作は未確認です。'],[p])
file.write_text(json.dumps(records+additions,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Added {len(additions)} entries; total {len(records+additions)}.')
