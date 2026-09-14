"""Reviewed food/travel batch; no writes outside website/. Not a build step."""
import json,re,shutil
from pathlib import Path
web=Path(__file__).resolve().parents[1];repo=web.parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def pack(kind,n):return next((repo/f'{kind}_packs').glob(f'{"bp" if kind=="behavior" else "rp"}_{n:02d}_*'))
bp,rp=pack('behavior',15),pack('resource',2)
wb,wr=pack('behavior',11),pack('resource',12)
sha='aea85120954a8b74033b86253c17a04b691dab21'
file=web/'src/data/field-guide.json';records=read(file);new=[];names={};targets={}
def proof(paths):
    for p in paths:assert p.is_file(),p
    return {'commit':sha,'paths':list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
def add(slug,name,kind,owner,summary,description,usage,obtaining,details,paths,image=None,recipe=None):
    assert not any(e['id']==slug for e in records+new),slug
    e=dict(id=slug,name=name,kind=kind,contentId=owner,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=recipe,visibility='public',evidence=proof(paths));new.append(e);return e
def texture(resource,c,slug):
    table=resource/'textures/item_texture.json';key=c['minecraft:icon'];path=resource/(read(table)['texture_data'][key]['textures']+'.png');assert path.is_file()
    shutil.copyfile(path,web/f'public/images/items/{slug}.png')
    return {'src':f'/images/items/{slug}.png','alt':'パック内のアイテム画像','kind':'pack-texture'},[table,path]
for stem in ['pancake_batter','pancake','honey_pancake','berry_honey_pancake']:
    path=bp/f'items/{stem}.item.json';d=read(path)['minecraft:item'];c=d['components'];identifier=d['description']['identifier'];name=c['minecraft:display_name']['value'];slug=stem.replace('_','-');names[identifier]=name
    food=c.get('minecraft:food');details=['最大スタック数の設定：64。'];assert c['minecraft:max_stack_size']==64
    if food:
        assert not food['can_always_eat']
        details.append(f"満腹度の回復設定：{food['nutrition']}。実ゲームで測定した回復量ではありません。")
    else:details.append('生地には食料の設定がありません。焼いてから使う材料です。')
    pic,sources=texture(rp,c,slug)
    e=add(slug,name,'item','pancakes','焼いて仕上げるパンケーキの材料。' if not food else '冒険の食事に持っていくパンケーキ。',name+'の個別定義と製作方法を紹介します。生地から焼き上げ、ハチミツやベリーを加える構成です。','かまどで焼いてパンケーキを作る設定です。' if not food else '手に持って食べる設定です。満腹時の使用は許可されていません。','パンケーキ生地をかまどで焼く定義があります。' if stem=='pancake' else '関連する作業台レシピで材料を確認できます。',details,[path,bp/'recipes/pancake.recipe.json',*sources],pic)
    targets[identifier]=e
names.update({'minecraft:milk_bucket':'ミルク入りバケツ','minecraft:egg':'卵','minecraft:wheat':'小麦','minecraft:honey_bottle':'ハチミツ入りの瓶','minecraft:sweet_berries':'スイートベリー','minecraft:gold_ingot':'金インゴット','minecraft:gold_block':'金ブロック','minecraft:feather':'羽根'})
script=wb/'scripts/simple_waystone'
runtime=[wb/'manifest.json',script/'main.js',script/'events/index.js',script/'events/startUp.js',script/'ui/listUI.js',script/'lib/item/teleportItem.js',script/'lib/item/itemAmount.js']
for stem in ['warpstone','golden_feather','enchanted_golden_feather']:
    path=wb/f'items/simple_waystone/{stem}.json';d=read(path)['minecraft:item'];c=d['components'];identifier=d['description']['identifier'];name=re.sub('§.','',c['minecraft:display_name']['value']);slug='waystone-'+stem.replace('_','-');names[identifier]=name
    assert 'ws:warpstone' in c and c['minecraft:max_stack_size']==1
    detail={'warpstone':'使用時の移動処理でクールダウンを設定します。時間は設定に依存するため固定値では紹介していません。','golden_feather':'クリエイティブ以外では、移動直前に手に持った羽根を1個減らす処理があります。','enchanted_golden_feather':'専用の移動処理には羽根を減らす処理がありません。ただし移動先の経験値コスト判定は共通です。'}[stem]
    pic,sources=texture(wr,c,slug)
    e=add(slug,name,'item','simple-waystone','手に持って移動先の一覧を開く道具。','使用するとWaystoneの一覧を開き、利用できる移動先を選ぶ処理があります。アイテムごとに消費や待ち時間の扱いが異なります。','手に持って使用し、一覧から移動先を選ぶ構成です。経験値レベルが必要コストを下回る場合は移動を止めます。','作業台レシピを関連項目に掲載しています。' if stem!='warpstone' else '入手経路は確認中です。利用可能な移動先の登録も必要です。',[detail,'最大スタック数の設定：1。','実際の画面操作・移動先の安全性・経験値消費はゲーム内で未確認です。'],[path,*runtime,*sources],pic)
    targets[identifier]=e
paths=[bp/f'recipes/{s}.recipe.json' for s in ['pancake_batter','honey_pancake','berry_honey_pancake','berry_honey_pancake_from_honey']]+[wb/f'recipes/simple_waystone/{s}.json' for s in ['golden_feather','enchanted_golden_feather']]
for path in paths:
    doc=read(path);key=next(k for k in doc if k.startswith('minecraft:recipe'));r=doc[key];target=targets[r['result']['item']];shaped=key=='minecraft:recipe_shaped';assert r['tags']==['crafting_table']
    def label(i):
        assert set(i)=={'item'}
        return names[i['item']]
    grid=[[label(r['key'][s]) if s!=' ' else '' for s in row] for row in r['pattern']] if shaped else []
    ingredients=[n for row in grid for n in row if n] if shaped else [label(i) for i in r['ingredients']]
    alternate='from_honey' in path.name;suffix='（ハニーから）' if alternate else ''
    add('craft-'+target['id']+('-from-honey' if alternate else ''),target['name']+'のレシピ'+suffix,'recipe',target['contentId'],('配置を合わせて' if shaped else '配置自由で')+target['name']+'を作る設定。','作業台用の定義から材料と完成数を確認しています。','下の材料を作業台で組み合わせます。','材料の入手と実際のクラフトは未確認です。',[] if 'count' in r['result'] else ['完成数の指定は省略されているため、既定の1個として表示しています。'],[path],recipe={'shaped':shaped,'grid':grid,'ingredients':[{'name':n,'count':ingredients.count(n)} for n in dict.fromkeys(ingredients)],'resultId':target['id'],'count':r['result'].get('count',1)})
p=bp/'recipes/pancake.recipe.json';r=read(p)['minecraft:recipe_furnace'];assert r['tags']==['furnace'] and r['input']=='myname:pancake_batter' and r['output']=='myname:pancake'
add('cooking-pancake','パンケーキの焼き方','feature','pancakes','生地をかまどで焼いて、パンケーキに。','生地から完成品へ変える調理レシピです。作業台で生地を作り、かまどで焼き上げる流れになります。','かまどにパンケーキ生地を入れる設定です。','生地はミルク入りバケツ1個・卵4個・小麦4個を組み合わせて16個作るレシピがあります。',['調理設備の登録はかまどのみです。燻製器や焚き火の対応はこの定義から確認できません。','調理時間・燃料消費・経験値と実ゲームでの動作は未確認です。'],[p,bp/'recipes/pancake_batter.recipe.json'])
add('waystone-destination-lists','移動先一覧の切り替え','feature','simple-waystone','個人向けと公開中の移動先を切り替える。','Waystoneの画面は、個人向け一覧と公開一覧を切り替える構成です。表示される移動先は登録状態と設定に依存します。','一覧の切り替えボタンから対象を変え、表示された移動先を選ぶ処理です。','利用可能なWaystoneの登録が必要です。実際の設置先や公開範囲は未確認です。',['異なるディメンションの候補を表示するかどうかも設定に依存します。'],[*runtime,script/'lib/waystone/list.js'])
add('waystone-experience-cost','移動の経験値コスト','feature','simple-waystone','移動先を選ぶ前に、必要な経験値レベルを確認。','移動先一覧では距離・ディメンション・割引設定からコストを求めます。クリエイティブ以外では必要レベルを確認し、移動時にそのレベルを差し引く処理です。','一覧に表示するコストを確認する構成です。固定の必要レベルとしては紹介していません。','移動用アイテムが消費されない場合でも、経験値のコスト判定は共通です。',['実際の消費量、移動が失敗したときの扱いは未検証です。'],[*runtime,script/'lib/waystone/space.js',script/'variables.js'])
contentfile=web/'src/data/content-registry.json';contents=read(contentfile);packfile=web/'src/data/pack-registry.json';packs=read(packfile)
for slug,title,b,r,category,summary,description,highlights in [('pancakes','Pancakes',bp,rp,['craft'],'生地を焼き、ハチミツとベリーで仕上げよう。','生地と3種類のパンケーキを扱う食料コンテンツです。生地の作業台レシピ、かまどでの調理、トッピングの2通りの組み合わせを紹介します。',['生地は1回のレシピで16個','かまどで焼くパンケーキ','ハチミツとベリーで仕上げる食事']),('simple-waystone','Simple Waystone',wb,wr,['exploration','systems'],'登録された移動先を選び、拠点間の移動を支える。','移動先一覧と携帯用のワープストーン・羽根を紹介します。移動の経験値コスト、道具の消費と待ち時間を分けて説明しています。実際の設置先と本番の利用条件は未確認です。',['個人向け・公開中の移動先一覧','携帯できる3つの移動アイテム','経験値と消費条件を確認'])]:
    c=next(c for c in contents['contents'] if c['id']==slug)
    c.update(name=title,visibility='public',implementation='partial',deployment='repo-only',summary=summary,description=description,category=category,image={'src':f'/images/{slug}.svg','alt':title+'の仮イラスト。実画面ではありません。','kind':'concept'},highlights=highlights,guide='関連するアイテム・レシピ・機能の図鑑で使い方を確認できます。実ゲームでの使用・表示・提供状況は未確認です。',children=[],related=[],packBindings=[],verification=[{'kind':'code','result':'confirmed','commit':sha},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],evidence=proof([b/'manifest.json',r/'manifest.json']))
    for kind,p in [('behavior',b),('resource',r)]:
        h=read(p/'manifest.json')['header'];registered=any(x['pack_id']==h['uuid'] and x['version']==h['version'] for x in read(repo/f'world_{kind}_packs.json'))
        if not any(x['uuid']==h['uuid'] for x in packs['packs']):packs['packs'].append(dict(uuid=h['uuid'],name=title+(' BP' if kind=='behavior' else ' RP'),kind=kind,version='.'.join(map(str,h['version'])),registered=registered,visibility='public'))
        c['packBindings'].append({'uuid':h['uuid'],'roles':['item-definition','recipe'] if kind=='behavior' else ['texture']})
for p,data in [(file,records+new),(contentfile,contents),(packfile,packs)]:p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Added {len(new)} entries; total {len(records+new)}.')
