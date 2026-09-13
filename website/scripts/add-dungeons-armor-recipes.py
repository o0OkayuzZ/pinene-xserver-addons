"""Publish verified armor crafting layouts; never writes game packs."""
import json
from pathlib import Path
from collections import Counter
web=Path(__file__).resolve().parents[1];repo=web.parent
bp=next((repo/'behavior_packs').glob('bp_08_*'))
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
records=read(web/'src/data/field-guide.json');groups=read(web/'src/data/dungeons-guide.json')
assert not any(g['id']=='armor-recipes' for g in groups),'Batch already applied'
by_id={e['id']:e for e in records};group=dict(id='armor-recipes',title='防具の製作レシピ',intro='22系列・88部位の作り方。必要な材料、作業台の配置、完成品の説明を確認できます。',entries=[])
names={'honeycomb':'ハニカム','bee_nest':'ミツバチの巣','iron_boots':'鉄のブーツ','charcoal':'木炭','iron_ingot':'鉄インゴット',
 'iron_chestplate':'鉄のチェストプレート','iron_block':'鉄ブロック','iron_helmet':'鉄のヘルメット','redstone':'レッドストーンダスト',
 'iron_leggings':'鉄のレギンス','emerald':'エメラルド','wool':'羊毛','glow_ink_sac':'輝くイカスミ','gold_ingot':'金インゴット',
 'leather':'革','bone':'骨','cocoa_beans':'カカオ豆','phantom_membrane':'ファントムの皮膜','quartz':'ネザークォーツ',
 'vine':'ツタ','moss_block':'苔ブロック','end_stone':'エンドストーン','shulker_shell':'シュルカーの殻','ice':'氷',
 'lapis_lazuli':'ラピスラズリ','nether_sprouts':'ネザースプラウト','nether_wart':'ネザーウォート','ink_sac':'イカスミ',
 'ender_pearl':'エンダーパール','gunpowder':'火薬','turtle_scute':'カメのウロコ','string':'糸'}
for path in sorted((bp/'recipes/armor').rglob('*.json')):
    recipe=read(path)['minecraft:recipe_shaped'];assert recipe['tags']==['crafting_table']
    result=recipe['result'];target_id='dungeons-'+result['item'].split(':')[1].replace('_','-');target=by_id[target_id]
    assert target['kind']=='item' and target['visibility']=='public' and target['contentId']=='minecraft-dungeons'
    # The vanilla namespace is optional in two source ingredient definitions.
    keys={}
    for key,value in recipe['key'].items():
        assert set(value)=={'item'},value
        identifier=value['item'];assert ':' not in identifier or identifier.startswith('minecraft:')
        keys[key]=names[identifier.removeprefix('minecraft:')]
    assert all(ch==' ' or ch in keys for row in recipe['pattern'] for ch in row)
    grid=[[keys.get(ch,'') for ch in row] for row in recipe['pattern']];counts=Counter(x for row in grid for x in row if x)
    slug=target_id+'-recipe';assert slug not in by_id
    evidence={'commit':'aea85120954a8b74033b86253c17a04b691dab21','paths':[path.relative_to(repo).as_posix(),*target['evidence']['paths'][:1]]}
    entry=dict(id=slug,name=target['name']+'のレシピ',kind='recipe',contentId='minecraft-dungeons',summary=target['name']+'を作る材料と配置。',
      description='作業台の配置付きレシピです。完成品の防具を選び、材料の個数と配置を確認できます。',
      usage='作業台に下の配置どおり材料を並べます。空欄のマスには材料を置かない設定です。',
      obtaining='製作レシピの定義を照合しています。実際の製作・解放表示・左右反転の受付はゲーム内で未検証です。',
      details=['同じ系列でも部位によって材料が異なる場合があります。各レシピの配置を確認してください。'],image=None,
      recipe=dict(shaped=True,grid=grid,ingredients=[dict(name=k,count=v) for k,v in counts.items()],resultId=target_id,count=result.get('count',1)),
      visibility='public',evidence=evidence)
    records.append(entry);by_id[slug]=entry;group['entries'].append(slug)
    target['obtaining']='作業台で製作できるレシピがあります。関連レシピで材料・配置・完成数を確認してください。 '+target['obtaining']
    target['evidence']['paths'].append(path.relative_to(repo).as_posix())
assert len(group['entries'])==88
groups.insert(next(i for i,g in enumerate(groups) if g['id']=='armor')+1,group)
contents=read(web/'src/data/content-registry.json');c=next(c for c in contents['contents'] if c['id']=='minecraft-dungeons')
c['highlights'].append('22系列・88部位の防具の製作配置と、完成品への相互リンク。')
for path,data in [(web/'src/data/field-guide.json',records),(web/'src/data/dungeons-guide.json',groups),(web/'src/data/content-registry.json',contents)]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Added 88 armor recipes; total',len(records))
