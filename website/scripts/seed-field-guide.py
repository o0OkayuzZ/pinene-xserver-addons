"""Curated initial guide import. Reads BP/RP only; writes website data/assets.
Run only when intentionally rebuilding this initial catalogue, not during builds.
"""
import json, shutil
from pathlib import Path

web = Path(__file__).resolve().parents[1]
repo = web.parent
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p, value): p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
def folder(kind, n): return next((repo/f'{kind}_packs').glob(f'{"bp" if kind == "behavior" else "rp"}_{n:02d}_*'))
bp, rp = folder('behavior',15), folder('resource',2)
xp = folder('behavior',14)
entries=[]
sha='aea85120954a8b74033b86253c17a04b691dab21'
def evidence(paths):
    for p in paths: assert p.is_file(), p
    return {'commit':sha,'paths':[p.relative_to(repo).as_posix() for p in paths]}
def picture(pack,key,slug):
    table=read(pack/'textures/item_texture.json')['texture_data']
    texture=table[key]['textures']
    if isinstance(texture,dict): texture=texture['default']
    source=pack/(texture+'.png')
    assert source.is_file(),source
    dest=web/'public/images/items'/f'{slug}.png'
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,dest)
    return {'src':f'/images/items/{slug}.png','alt':'パック内のアイテム画像','kind':'pack-texture'},source
def add(slug,name,kind,content,summary,description,usage,obtaining,details,paths,image=None,recipe=None):
    entries.append(dict(id=slug,name=name,kind=kind,contentId=content,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=recipe,visibility='public',evidence=evidence(paths)))
effects={'regeneration':'再生','darkness':'暗闇','nausea':'吐き気','haste':'採掘速度上昇','hunger':'空腹','speed':'移動速度上昇','jump_boost':'跳躍力上昇','resistance':'耐性','slowness':'移動速度低下','strength':'攻撃力上昇','weakness':'弱体化','mining_fatigue':'採掘速度低下','absorption':'衝撃吸収','fatal_poison':'致死毒','poison':'毒','wither':'衰弱','night_vision':'暗視','slow_falling':'低速落下'}
def effect_text(fs): return '、'.join(f"{effects[f['effect']]} レベル{f['level']}・{f['seconds']}秒" for f in fs)
registry=bp/'scripts/mycology/registry.js'
mushrooms=json.loads(registry.read_text(encoding='utf-8').split('export const MUSHROOMS = ',1)[1].split(';\nexport const BY_ID',1)[0])
for m in mushrooms:
    slug='mycology-'+m['id'].lower()
    definition=bp/f"items/mycology/{m['id'].lower()}.json"
    components=read(definition)['minecraft:item']['components']
    assert read(definition)['minecraft:item']['description']['identifier']==m['itemId']
    mode=m['useMode']; color='赤色' if m['group']=='red' else '茶色'
    assert (mode=='eat' and 'pinene:myco_consume' in components) or (mode=='crush' and 'pinene:myco_crush' in components) or mode=='specimen'
    detail=[]
    if m['effects']: detail.append('基本効果：'+effect_text(m['effects'])+'。')
    special=m['special']
    if special:
        kind=special['kind']
        if kind=='damage_first': detail.append(f"効果の前に体力を{special['damageHp']}HP消費します。体力が足りない場合は死亡する処理です。")
        elif kind=='delayed': detail.append(f"遅延効果：{special['delaySeconds']}秒後に"+effect_text(special['effects'])+'。')
        elif kind=='choice':
            detail.append('追加効果は次の候補から重み付きで1つ抽選されます。')
            for choice in special['choices']: detail.append('抽選候補：'+effect_text(choice['effects'])+'。')
        elif kind=='sense': detail.append(f"半径{special['radius']}ブロック以内の対象Mobを、使用後"+'・'.join(map(str,special['timesSeconds']))+'秒に粒子で示す設定です。プレイヤー・鑑定士などは対象外です。')
        elif kind=='spore_burst': detail.append(f"半径{special['radius']}ブロック以内の対象Mobに"+effect_text(special['targetEffects'])+'。プレイヤー・鑑定士などは対象外です。')
        else: raise ValueError(kind)
    if mode=='specimen':
        summary='使って消費せず、発見を記録する研究標本。'
        usage='ゲーム内では研究標本として定義されています。食べる・握り潰す操作はありません。'
        detail.append('使用時の効果は設定されていません。研究ポイントの付与も現在は無効です。')
    elif mode=='crush':
        summary='握り潰して使う、胞子の効果を持つキノコ。'
        usage='手に持って使用すると握り潰す処理です。食べるアイテムではありません。クリエイティブ以外では1個消費します。'
    else:
        names='・'.join(effects[f['effect']] for f in m['effects'])
        summary=(names+'の設定を持つキノコ。') if names else ('時間差で効果が現れるキノコ。' if special and special['kind']=='delayed' else '使用時に特殊な効果を持つキノコ。')
        usage='ゲーム内で食べて使用する設定です。有利な効果だけでなく、不利な効果や体力消費も確認してから使ってください。'
        detail.append(f"満腹度の回復設定：{m['food']['nutrition']}。")
    if m['cooldownSeconds']: detail.append(f"使用後のクールダウン設定：{m['cooldownSeconds']}秒。")
    pic,source=picture(rp,m['textureKey'],slug)
    add(slug,m['nameJa'],'item','mycology',summary,f"{color}キノコの鑑定結果として登録されている、Mycologyの{m['nameJa']}です。ゲーム内のレア度設定は★{m['rarity']}。以下は現行コードの効果設定であり、本番での動作は未確認です。",usage,f"通常の{color}キノコを鑑定する抽選テーブルに含まれます。特定の種類を確定で入手できる方法は確認していません。",detail,[registry,definition,bp/'scripts/mycology/effects.js',bp/'scripts/mycology/appraisal.js',rp/'textures/item_texture.json',source],pic)

pic,source=picture(rp,'pinene_myco_field_guide','mushroom-field-guide')
add('mushroom-field-guide','キノコ図鑑','item','mycology','手元から、自分のキノコの発見記録を開く。','Mycologyの図鑑を開くための本です。発見記録は本そのものではなくプレイヤーごとに管理されます。','手に持って使用すると図鑑を開く処理が登録されています。実際の画面表示は未確認です。','作業台で本・赤色キノコ・茶色キノコを各1個使う、配置自由のレシピがあります。',['最大スタック数の設定は1です。','未発見のキノコは名前を伏せて表示する構成です。'],[bp/'items/mycology_tools/field_guide.json',bp/'scripts/mycology/field_guide.js',bp/'scripts/mycology/ui.js',bp/'recipes/mycology_field_guide.json',source],pic)

xp_specs=[
('xp-tank','経験値タンク','経験値をためる、ストレージの中心になるブロック。','経験値を蓄積し、接続した配管やタンクへ受け渡す処理があります。','コード上ではタンクの上でスニークすると経験値を預ける処理です。十分な残量があると、ガラス瓶の使用で経験値の瓶を作る処理もあります。'),
('xp-pipe','経験値パイプ','タンクや抽出器をつなぐ、経験値の通り道。','経験値を表す要素を配管に沿って移動させるためのブロックです。','タンクや抽出器などと組み合わせて配置します。接続方向と流れを制御する処理がありますが、実際の配置例は未確認です。'),
('xp-valve','経験値バルブ','配管の流れを切り替えるための部品。','隣接するパイプの流れを切り替える処理を持つブロックです。','コード上ではバルブへの使用操作で開閉状態を切り替えます。向きに応じた隣接パイプにも状態を反映します。'),
('xp-extractor','経験値抽出器','プレイヤーの経験値を配管側へ取り出す入口。','スニーク中のプレイヤーから経験値を取り出す処理があるブロックです。','コード上ではプレイヤーの位置にあるブロックが抽出器かを判定します。配管への取り付け方や実際の操作はゲーム内での確認が必要です。'),
]
names={'minecraft:glass':'ガラス','minecraft:emerald':'エメラルド','minecraft:book':'本','minecraft:red_mushroom':'赤色キノコ','minecraft:brown_mushroom':'茶色キノコ','effectoo:xp_pipe':'経験値パイプ'}
def recipe_entry(path,slug,name,content,target):
    doc=read(path); shaped='minecraft:recipe_shaped' in doc
    r=doc['minecraft:recipe_shaped' if shaped else 'minecraft:recipe_shapeless']
    counts={}
    if shaped:
        grid=[[names[r['key'][char]['item']] if char!=' ' else '' for char in row] for row in r['pattern']]
        for row in grid:
            for item in row:
                if item: counts[item]=counts.get(item,0)+1
    else:
        grid=[]
        for ing in r['ingredients']:
            item=names[ing['item']]; counts[item]=counts.get(item,0)+ing.get('count',1)
    info={'shaped':shaped,'grid':grid,'ingredients':[{'name':n,'count':c} for n,c in counts.items()],'resultId':target,'count':r['result']['count']}
    add(slug,name+'のレシピ','recipe',content,('配置を合わせて' if shaped else '配置自由で')+f"{name}を{info['count']}個作る設定。",'作業台用のレシピファイルから、材料・配置・完成数を確認しています。ゲーム内のクラフト動作は未確認です。','材料を用意して作業台を使う設定です。配置指定がある場合は下の表を参照してください。','レシピの解放条件や本番での提供状況は別途確認が必要です。',[],[path],recipe=info)
for slug,name,summary,desc,usage in xp_specs:
    internal=slug.replace('-','_')
    definition=xp/f'blocks/{internal}.json'
    assert read(definition)['minecraft:block']['description']['identifier']=='effectoo:'+internal
    add(slug,name,'item','xp-storage',summary,desc+'現在はコードの確認のみで、本番の動作は未確認です。',usage,'作業台用のレシピ定義があります。材料と配置は関連レシピを参照してください。',['経験値の増減を伴います。容量・転送量・回収時の損失がないことはゲーム内で未検証です。'],[definition,xp/'scripts/index.js',xp/f'recipes/{internal}.json'])
    recipe_entry(xp/f'recipes/{internal}.json','craft-'+slug,name,'xp-storage',slug)
recipe_entry(bp/'recipes/mycology_field_guide.json','craft-mushroom-field-guide','キノコ図鑑','mycology','mushroom-field-guide')

for slug,name,summary,desc,paths in [
('mushroom-appraisal','キノコの鑑定','赤色・茶色のキノコを、種類ごとのキノコへ。','鑑定士の画面で色を選び、最初の該当スタックをまとめて鑑定する処理です。別スロットの同じキノコは合算しません。鑑定後は結果と新規発見を確認する構成です。',['ui.js','appraisal.js']),
('mushroom-discoveries','キノコの発見記録','集めた種類を、自分だけの図鑑に記録。','鑑定で見つけた種類をプレイヤーごとに保存します。発見済みの項目は名前とレア度を表示し、未発見の項目は伏せる構成です。図鑑の本を別の人に渡しても、記録を本で受け渡す仕組みではありません。',['progress.js','ui.js','field_guide.js']),
('mushroom-use-modes','キノコの使い分け','食べる・握り潰す・標本を区別しよう。','Mycologyには食べて使うもの、握り潰して使うもの、使用しない研究標本があります。食べる設定でも不利な効果がある場合があります。図鑑で個別の設定を確認してください。',['effects.js','ui.js'])]:
    add(slug,name,'feature','mycology',summary,desc,'実際の画面操作と本番での利用状況は未確認です。','Mycologyに含まれる機能です。鑑定士に会える場所は確認中です。',[],[bp/'scripts/mycology'/p for p in paths])

# Two selected Dungeons items: no unverified damage values or drops.
dbp,drp=folder('behavior',8),folder('resource',6)
for slug,name,key,rel,desc in [
('hawkbrand','ホークブランド','hawkbrand','items/melee/longsword/sword_hawkbrand.json','剣として登録されたDungeonsの装備です。独自の振り動作や耐久値、修理材料の設定があります。クリティカルなどの実際の発動条件やダメージ量は未確認のため掲載していません。'),
('book-of-heroes','英雄の書','book_of_heroes','items/book_of_heroes.json','Dungeonsの本アイテムです。専用の使用コンポーネントと「読む」の操作表示が定義されています。表示内容とコレクション機能のゲーム内動作は確認中です。')]:
    pic,source=picture(drp,key,slug)
    add(slug,name,'item','minecraft-dungeons','Dungeonsの'+('剣装備。' if slug=='hawkbrand' else '本アイテム。'),desc,'個別の操作や特殊な効果は確認中です。原作と同じ性能とは断定していません。','クラフト・ドロップ・取引などの入手経路は確認中です。',[],[dbp/rel,drp/'texts/ja_JP.lang',drp/'textures/item_texture.json',source],pic)

save(web/'src/data/field-guide.json',entries)
# Promote the reviewed experience storage content, retaining its existing slug.
registry_path=web/'src/data/content-registry.json'
contents=read(registry_path)
c=next(c for c in contents['contents'] if c['id']=='xp-storage')
c.update(summary='経験値をためて、配管でつなぐストレージ。',description='経験値タンク、パイプ、バルブ、抽出器を組み合わせるコンテンツです。プレイヤーから経験値を預ける処理、配管で受け渡す処理、流れを切り替える処理を確認しています。本番での動作や経験値の収支は未検証です。',category=['systems','craft'],visibility='public',implementation='partial',deployment='repo-only',verification=[{'kind':'code','result':'confirmed','commit':sha},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],image={'src':'/images/xp-storage.svg','alt':'経験値タンクと配管の仮イラスト。実画面ではありません。','kind':'concept'},highlights=['タンクに経験値を保管する仕組み','パイプとバルブによる接続・流れの切り替え','4種類のブロックに作業台レシピを定義'],guide='各ブロックの説明とレシピを図鑑にまとめています。実際の設置や操作、経験値が失われないことの確認は未実施です。',children=[],related=[],packBindings=[],evidence=evidence([xp/'manifest.json',xp/'scripts/index.js']))
pack_path=web/'src/data/pack-registry.json'; packs=read(pack_path)
for kind,n in [('behavior',14),('resource',18)]:
    pack=folder(kind,n); h=read(pack/'manifest.json')['header']; rows=read(repo/f'world_{kind}_packs.json')
    registered=any(row['pack_id']==h['uuid'] and row['version']==h['version'] for row in rows)
    p=dict(uuid=h['uuid'],name='経験値ストレージ '+('BP' if kind=='behavior' else 'RP'),kind=kind,version='.'.join(map(str,h['version'])),registered=registered,visibility='public')
    if not any(existing['uuid']==p['uuid'] for existing in packs['packs']): packs['packs'].append(p)
    c['packBindings'].append({'uuid':h['uuid'],'roles':['runtime-script','recipe','behavior'] if kind=='behavior' else ['texture','model']})
save(pack_path,packs); save(registry_path,contents)
print(f'Created {len(entries)} field guide entries, including {len(mushrooms)} mushrooms.')
