"""Append the reviewed food/equipment batch; reads Minecraft files only.
Not part of the build. Refuses to replace existing guide entries.
"""
import json, re, shutil
from pathlib import Path
web=Path(__file__).resolve().parents[1]; repo=web.parent
def read(p): return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,data): p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
def pack(kind,n): return next((repo/f'{kind}_packs').glob(f'{"bp" if kind=="behavior" else "rp"}_{n:02d}_*'))
foodbp,foodrp=pack('behavior',2),pack('resource',5)
gearbp,gearrp=pack('behavior',5),pack('resource',15)
records=read(web/'src/data/field-guide.json'); additions=[]
names={}; id_to_slug={}
sha='aea85120954a8b74033b86253c17a04b691dab21'
def proof(paths):
    for p in paths: assert p.is_file(),p
    return {'commit':sha,'paths':list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
def image(rp,components,slug):
    icon=components.get('minecraft:icon')
    if not icon:return None,[]
    key=icon if isinstance(icon,str) else icon['textures']['default']
    table=rp/'textures/item_texture.json'; texture=read(table)['texture_data'][key]['textures']
    if isinstance(texture,dict):texture=texture['default']
    if isinstance(texture,list):
        assert len(texture)==1,texture
        texture=texture[0]
    assert isinstance(texture,str),texture
    path=rp/(texture+'.png')
    if not path.is_file():return None,[table]
    dest=web/f'public/images/items/{slug}.png';shutil.copyfile(path,dest)
    return {'src':f'/images/items/{slug}.png','alt':'パック内のアイテム画像','kind':'pack-texture'},[table,path]
def add(slug,name,kind,owner,summary,description,usage,obtaining,details,paths,pic=None,recipe=None):
    assert not any(e['id']==slug for e in records+additions),slug
    additions.append(dict(id=slug,name=name,kind=kind,contentId=owner,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=pic,recipe=recipe,visibility='public',evidence=proof(paths)))
fooddata=foodbp/'scripts/golden_foods/data.js'
foods=json.loads(fooddata.read_text(encoding='utf-8').split('export const FOODS = ',1)[1].rsplit(';',1)[0])
effect_names={'night_vision':'暗視','haste':'採掘速度上昇','speed':'移動速度上昇','regeneration':'再生','resistance':'耐性','absorption':'衝撃吸収','fire_resistance':'火炎耐性'}
foodpaths=[foodbp/'manifest.json',fooddata,foodbp/'scripts/golden_foods/main.js',foodbp/'scripts/golden_foods/core.js',foodbp/'scripts/golden_foods/capabilities.js']
food_defs={}
for path in sorted((foodbp/'items').glob('*.json')):
    definition=read(path)['minecraft:item']; identifier=definition['description']['identifier']; c=definition['components']
    names[identifier]=c['minecraft:display_name']['value'];food_defs[identifier]=(path,c)
    if 'minecraft:food' not in c:continue
    assert 'pinene:golden_food_consume' in c,identifier
    data=foods[identifier]; base=c['minecraft:food']
    assert data['name']==names[identifier]
    for key in ('nutrition','saturation_modifier','can_always_eat'):assert base[key]==data['food'][key],(identifier,key)
    slug='food-'+path.stem.replace('_','-');id_to_slug[identifier]=slug
    mode='飲む' if c.get('minecraft:use_animation')=='drink' else '食べる'
    details=[f"満腹度の回復設定：{base['nutrition']}。","食事の数値は現行コードの設定です。暫定値を含み、本番での回復量を測定した結果ではありません。"]
    for effect in data['effects']:details.append(f"基本効果：{effect_names[effect['id']]} レベル{effect['amplifier']+1}・{effect['seconds']}秒。")
    if not data['effects']:details.append('この食事処理で付与する基本効果はありません。')
    if 'using_converts_to' in base:
        container={'minecraft:bowl':'ボウル','minecraft:bucket':'バケツ'}[base['using_converts_to']]
        details.append(f'使い終わると{container}に変わる設定です。')
    usage=f"手に持って{mode}設定です。"+('満腹時にも使用できる設定があります。' if base['can_always_eat'] else '満腹時の使用を許可する設定にはなっていません。')
    if data['family']=='milk':usage+='通常の牛乳と同じ状態異常解除は、この食事処理にはありません。'
    summary='・'.join(effect_names[e['id']] for e in data['effects'])+'の基本効果を持つ食料。' if data['effects'] else '満腹度を回復する食料。追加の基本効果はありません。'
    pic,sources=image(foodrp,c,slug)
    add(slug,data['name'],'item','golden-foods',summary,f"Golden Foodsの{data['name']}です。個別の食料定義と食べたときの処理を照合し、有効な基本効果を記載しています。効果を強く重ねることを保証するものではありません。",usage,'入手経路はアイテムごとに確認中です。関連レシピが掲載されているものは、その材料と配置を参照してください。',details,[path,*foodpaths,*sources],pic)

# Utility book: its UI entrypoint is explicitly connected in the manifest script.
path,c=food_defs['pinene:golden_food_guide'];slug='golden-food-guide';id_to_slug['pinene:golden_food_guide']=slug
pic,sources=image(foodrp,c,slug)
add(slug,names['pinene:golden_food_guide'],'item','golden-foods','金の食料の設定を、ゲーム内で読み返すための本。','使用すると金食料図鑑の画面を開く処理があります。Webの図鑑とは別に、ゲーム内で食料を選んで情報を見る構成です。','手に持って使用する設定です。画面の実際の表示・操作は未確認です。','作業台用のレシピ定義があります。詳しい入手手順は確認中です。',['図鑑を開く処理は食事処理とは別に登録されています。','アイテム自体に食料コンポーネントはありません。'],[path,foodbp/'scripts/golden_foods/main.js',foodbp/'scripts/golden_foods/guide.js',foodbp/'recipes/golden_food_guide.json',*sources],pic)

lang={line.split('=',1)[0]:line.split('=',1)[1] for line in (gearrp/'texts/ja_JP.lang').read_text(encoding='utf-8').splitlines() if '=' in line}
definitions={}
for path in (gearbp/'items').rglob('*.json'):
    d=read(path)['minecraft:item'];definitions[d['description']['identifier']]=(path,d['components'])
selected=[f'true_dn:{family}_{part}' for family in ['deathnerite','parcanite'] for part in ['helmet','chestplate','leggings','boots','sword','pickaxe','axe','shovel','hoe']]+['true_dn:deathnerite_ingot','true_dn:darkness_upgrade_smithing_template','true:special_smithing_table']
smithing=gearbp/'scripts/SmithingRecipes.js'
smithing_text=smithing.read_text(encoding='utf-8')
smithing_rows=[dict(re.findall(r"(template|base|addition|result):\s*'([^']+)'",block)) for block in re.findall(r'\{([^{}]+)\}',smithing_text)]
smithing_rows=[row for row in smithing_rows if len(row)==4]
for identifier in selected:
    path,c=definitions[identifier];name=c.get('minecraft:display_name',{}).get('value') or lang['item.'+identifier]
    names[identifier]=name;id_to_slug[identifier]=identifier.split(':')[1].replace('_','-')
for identifier in selected:
    path,c=definitions[identifier];slug=id_to_slug[identifier];name=names[identifier]
    wearable=c.get('minecraft:wearable');details=[]
    if c.get('minecraft:durability'):details.append(f"耐久値の設定：{c['minecraft:durability']['max_durability']}。")
    if wearable:details.append(f"防御値の設定：{wearable['protection']}。実際の軽減率や他の効果を含めた耐久性は未確認です。")
    if 'minecraft:damage' in c:details.append(f"アイテムのダメージ設定値：{c['minecraft:damage']}。実際の攻撃ダメージは対象・装備・効果などで変わるため、この値と同じとは限りません。")
    if c.get('minecraft:max_stack_size'):details.append(f"最大スタック数の設定：{c['minecraft:max_stack_size']}。")
    part=identifier.split('_')[-1]
    uses={'sword':'手に持って攻撃に使う剣です。','pickaxe':'石や鉱石などの採掘向けに定義されたツルハシです。','axe':'木材などの伐採向けに定義された斧です。','shovel':'土などを掘る道具として定義されたシャベルです。','hoe':'耕作向けに定義されたクワです。'}
    if wearable:
        slot={'slot.armor.head':'頭','slot.armor.chest':'胴','slot.armor.legs':'脚','slot.armor.feet':'足'}[wearable['slot']]
        summary=f'{slot}に装備する、'+('デスネライト' if 'deathnerite_' in identifier else 'パーカナイト')+'の防具。'
        usage=f'{slot}の防具スロットに装備する設定です。防御値・耐久値は下記を参照してください。特殊能力のゲーム内動作は確認中です。'
    elif part in uses:summary=uses[part];usage=uses[part]+'採掘速度や特殊なブロック操作のゲーム内動作は確認中です。'
    elif identifier=='true_dn:deathnerite_ingot':summary='デスネライトの装備を作るための素材。';usage='装備の作業台レシピや、高度な鍛冶台の強化材料として使う設定があります。'
    elif identifier=='true_dn:darkness_upgrade_smithing_template':summary='パーカナイトへの強化に使う鍛冶素材。';usage='パーカナイト装備の作業台レシピや、高度な鍛冶台のテンプレート欄で使う設定です。'
    else:summary='型・元の装備・追加素材を組み合わせる専用の鍛冶台。';usage='設置後、専用インベントリの型・ベース・追加素材の欄を使う処理があります。対応する組み合わせでは各材料を1個ずつ消費し、結果を1個作る構成です。画面と実際の変換は未確認です。'
    recipes=[row for row in smithing_rows if row['result']==identifier]
    obtaining='作業台のレシピや専用の強化経路は、確認できたものから掲載します。'
    sources=[path,gearbp/'manifest.json',gearbp/'scripts/main.js',smithing,gearrp/'texts/ja_JP.lang']
    if recipes:
        row=recipes[0]
        # Explain each smithing input by exact item identity, not by folder/file name.
        vanilla={'minecraft:netherite_upgrade_smithing_template':'ネザライト強化用の鍛冶型','minecraft:echo_shard':'残響の欠片'}
        slots={'helmet':'ヘルメット','chestplate':'チェストプレート','leggings':'レギンス','boots':'ブーツ','sword':'剣','pickaxe':'ツルハシ','axe':'斧','shovel':'シャベル','hoe':'クワ'}
        vanilla.update({'minecraft:netherite_'+key:'ネザライトの'+value for key,value in slots.items()})
        def label(item):return names[item] if item in names else vanilla[item]
        obtaining=f"高度な鍛冶台のコードでは、型「{label(row['template'])}」・ベース「{label(row['base'])}」・追加素材「{label(row['addition'])}」の組み合わせで作る設定があります。作業台レシピとは別の経路です。ゲーム内の変換は未確認です。"
    if identifier=='true:special_smithing_table':obtaining='作業台で鍛冶台・金インゴット・ネザライトインゴットを組み合わせる、配置自由のレシピがあります。';sources.append(gearbp/'recipes/deathnerite_recipe/special_smithing_table.json')
    pic,imagepaths=image(gearrp,c,slug)
    add(slug,name,'item','deathnerite',summary,f'Deathneriteに含まれる{name}です。個別定義で確認できた用途と設定を紹介しています。装備一式の性能や追加効果がすべて動作することを確認したものではありません。',usage,obtaining,details,[*sources,*imagepaths],pic)

# Only six selected crafting-table recipes; smithing is described separately.
vanilla={'minecraft:gold_ingot':'金インゴット','minecraft:gold_block':'金ブロック','minecraft:beetroot':'ビートルート','minecraft:stick':'棒','minecraft:netherite_ingot':'ネザライトインゴット','minecraft:smithing_table':'鍛冶台'}
def material(ingredient):
    assert not set(ingredient)-{'item','count'},ingredient
    identifier=ingredient['item'];return names.get(identifier) or vanilla[identifier]
for path in [foodbp/'recipes/gbread.json',foodbp/'recipes/golden_foods_enchanted_bread.json',foodbp/'recipes/golden_foods_golden_beetroot.json',gearbp/'recipes/deathnerite_recipe/equipment/deathnerite_sword.json',gearbp/'recipes/deathnerite_recipe/equipment/parcanite_sword.json',gearbp/'recipes/deathnerite_recipe/special_smithing_table.json']:
    doc=read(path);shaped='minecraft:recipe_shaped' in doc;r=doc['minecraft:recipe_shaped' if shaped else 'minecraft:recipe_shapeless']
    assert r['tags']==['crafting_table'];identifier=r['result']['item'];target=id_to_slug[identifier];name=names[identifier]
    owner='golden-foods' if path.is_relative_to(foodbp) else 'deathnerite';counts={}
    grid=[[material(r['key'][key]) if key!=' ' else '' for key in row] for row in r['pattern']] if shaped else []
    if shaped:
        for row in grid:
            for label in row:
                if label:counts[label]=counts.get(label,0)+1
    else:
        for ingredient in r['ingredients']:
            label=material(ingredient);counts[label]=counts.get(label,0)+ingredient.get('count',1)
    count=r['result'].get('count',1)
    details=[] if 'count' in r['result'] else ['元のレシピでは完成数の指定が省略されています。ここでは既定の1個として表示しています。']
    if identifier=='true_dn:parcanite_sword':details.append('この作業台レシピの追加材料はネザライトインゴットです。高度な鍛冶台の強化処理ではデスネライトインゴットを使う別の組み合わせです。')
    add('craft-'+target,name+'のレシピ','recipe',owner,('配置を合わせて' if shaped else '配置自由で')+f'{name}を作る設定。','作業台用のレシピ定義から材料と完成品を確認しています。ゲーム内のクラフト動作は未確認です。','作業台で材料を組み合わせる設定です。配置指定がある場合は下の表を参照してください。','材料の入手方法と、本番でのレシピ解放は確認中です。',details,[path],recipe={'shaped':shaped,'grid':grid,'ingredients':[{'name':n,'count':c} for n,c in counts.items()],'resultId':target,'count':count})
add('golden-food-effect-priority','食事効果の優先ルール','feature','golden-foods','食べ直しても、強い効果を弱い効果で上書きしない。','Golden Foodsの基本効果では、すでに同じ種類の強い効果がある場合、その効果を優先する処理です。同じ強さでも、現在の残り時間が新しい食事効果以上なら変更しません。','食事時に適用される判定です。別のポーションやビーコンなどとの実際の組み合わせは未検証です。','専用操作や追加アイテムの入手は不要な、食事処理の一部です。',['効果の強さや時間を加算して増幅する仕組みではありません。'],[foodbp/'scripts/golden_foods/core.js',foodbp/'scripts/golden_foods/main.js'])
add('special-smithing-process','高度な鍛冶台での強化','feature','deathnerite','型・元の装備・追加素材の3つを照合して強化。','専用鍛冶台の処理では3種類の入力を組み合わせ、登録された強化先を作ります。材料を各1個消費して、完成品を1個出力する構成です。通常の作業台レシピとは材料が異なる場合があります。','対応する組み合わせを各アイテムの入手方法で確認してください。インベントリの実際の操作と引き継がれる装備情報は未検証です。','高度な鍛冶台の設置・使用を前提にした機能です。設置用アイテムには作業台レシピがあります。',[],[gearbp/'scripts/main.js',smithing])

contentpath=web/'src/data/content-registry.json'; contentdata=read(contentpath)
packpath=web/'src/data/pack-registry.json';packdata=read(packpath)
for slug,name,bpn,rpn,summary,description,categories,highlights in [
('golden-foods','Golden Foods',2,5,'食事と基本効果で、冒険の準備を整える。','金のパンや野菜、シチュー、ミルクなどを扱うコンテンツです。食事による回復と基本効果、ゲーム内図鑑の処理を確認しています。無効な追加能力や構想段階の機能は、使えるものとして紹介していません。',['craft','systems'],['食料ごとに異なる満腹度と基本効果','ゲーム内で食料の説明を読む図鑑','強い既存効果を優先する食事処理']),
('deathnerite','Deathnerite',5,15,'素材を集め、道具と防具を次の段階へ。','デスネライトとパーカナイトの道具・防具、素材、専用の鍛冶台を扱うコンテンツです。個別装備の設定と作業台・専用鍛冶台の強化経路を区別して紹介します。特殊能力やゲーム内の変換は未確認です。',['combat','craft'],['道具・防具ごとの耐久値と基本設定','作業台のレシピと専用鍛冶台の強化','用途を確認できた素材と設置用アイテム'])]:
    c=next(c for c in contentdata['contents'] if c['id']==slug)
    c.update(name=name,summary=summary,description=description,category=categories,visibility='public',implementation='partial',deployment='repo-only',verification=[{'kind':'code','result':'confirmed','commit':sha},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],image={'src':f'/images/{slug}.svg','alt':name+'の仮イラスト。実画面ではありません。','kind':'concept'},highlights=highlights,guide='関連アイテムの図鑑で、用途・使い方・確認できた入手経路を紹介しています。本番での入手、使用、表示は未確認です。',children=[],related=[],packBindings=[],evidence=proof([pack('behavior',bpn)/'manifest.json']))
    for kind,n in [('behavior',bpn),('resource',rpn)]:
        h=read(pack(kind,n)/'manifest.json')['header'];registration=read(repo/f'world_{kind}_packs.json')
        verified=any(row['pack_id']==h['uuid'] and row['version']==h['version'] for row in registration)
        if not any(p['uuid']==h['uuid'] for p in packdata['packs']):packdata['packs'].append(dict(uuid=h['uuid'],name=name+(' BP' if kind=='behavior' else ' RP'),kind=kind,version='.'.join(map(str,h['version'])),registered=verified,visibility='public'))
        c['packBindings'].append({'uuid':h['uuid'],'roles':['item-definition','runtime-script','recipe'] if kind=='behavior' else ['texture','model']})
save(web/'src/data/field-guide.json',records+additions);save(contentpath,contentdata);save(packpath,packdata)
print(f'Added {len(additions)} entries; total {len(records+additions)}.')
