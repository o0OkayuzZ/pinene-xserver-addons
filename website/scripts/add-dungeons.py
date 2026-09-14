"""Curated Dungeons website expansion; game files are read-only inputs."""
import json, re, shutil
from collections import Counter
from pathlib import Path

web = Path(__file__).resolve().parents[1]
repo = web.parent
bp = next((repo / 'behavior_packs').glob('bp_08_*'))
rp = next((repo / 'resource_packs').glob('rp_06_*'))
sha = 'aea85120954a8b74033b86253c17a04b691dab21'
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
records = read(web / 'src/data/field-guide.json')
assert not any(e['id'].startswith('dungeons-') for e in records), 'Batch already applied'
langpath = rp / 'texts/ja_JP.lang'
lang = dict(line.split('=', 1) for line in langpath.read_text(encoding='utf-8').splitlines() if '=' in line)
atlaspath = rp / 'textures/item_texture.json'
atlas = read(atlaspath)['texture_data']
def clean(text): return re.sub(r'[\ue000-\uf8ff]', '', re.sub(r'§.', '', text)).strip()
def name(identifier):
    value = lang.get('item.' + identifier) or lang.get('item.' + identifier + '.name')
    assert value, identifier
    return clean(value)
def proof(paths):
    for p in paths: assert p.is_file(), p
    return {'commit': sha, 'paths': list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
def add(slug, title, kind, summary, description, usage, obtaining, details, paths, image=None, recipe=None):
    assert not any(e['id'] == slug for e in records), slug
    entry = dict(id=slug, name=title, kind=kind, contentId='minecraft-dungeons', summary=summary,
                 description=description, usage=usage, obtaining=obtaining, details=details,
                 image=image, recipe=recipe, visibility='public', evidence=proof(paths))
    records.append(entry)
    return entry
groups = []
def group(key, title, intro):
    g = dict(id=key, title=title, intro=intro, entries=[])
    groups.append(g)
    return g

# Follow positive-weight loot table references. A matching entry is a candidate,
# not a guarantee; conditions and the live chest-opening route are not inferred.
roots = sorted((bp / 'loot_tables/chests/diamond_chest').glob('*.json'))
assert len(roots) == 14
def loot_path(path, identifier, seen=()):
    if path in seen: return None
    def visit(node):
        if isinstance(node, list):
            for child in node:
                result = visit(child)
                if result: return result
        elif isinstance(node, dict):
            if node.get('weight', 1) <= 0: return None
            if node.get('type') == 'item' and node.get('name') == identifier: return [path]
            if node.get('type') == 'loot_table':
                target = bp / node['name']
                if target.is_file():
                    result = loot_path(target, identifier, (*seen, path))
                    if result: return [path, *result]
            for key in ['pools', 'entries', 'children']:
                result = visit(node.get(key, []))
                if result: return result
        return None
    return visit(read(path))

selected = {}
def item(relative, g, summary, description, usage, extra=(), sources=()):
    path = bp / 'items' / relative
    itemdata = read(path)['minecraft:item']; identifier = itemdata['description']['identifier']; c = itemdata['components']
    slug = 'dungeons-' + identifier.split(':')[1].replace('_', '-')
    title = name(identifier)
    paths = [path, langpath, atlaspath, *sources]
    icon = c['minecraft:icon']; assert isinstance(icon, str)
    texture = atlas[icon]['textures']; assert isinstance(texture, str)
    source = rp / (texture + '.png'); assert source.is_file(), source
    shutil.copyfile(source, web / f'public/images/items/{slug}.png'); paths.append(source)
    details = list(extra)
    if 'minecraft:durability' in c: details.append(f"耐久値の設定：{c['minecraft:durability']['max_durability']}。")
    if 'minecraft:damage' in c: details.append(f"近接ダメージ成分の設定値：{c['minecraft:damage']['value']}。最終ダメージは攻撃処理や相手によって変わります。")
    if 'minecraft:wearable' in c:
        slots = {'slot.armor.head': '頭', 'slot.armor.chest': '胴', 'slot.armor.legs': '脚', 'slot.armor.feet': '足'}
        w = c['minecraft:wearable']; details.append(f"装備部位：{slots[w['slot']]}。防御値の設定：{w['protection']}。")
    if 'minecraft:cooldown' in c and '/artifact/' in path.as_posix(): details.append(f"再使用待ち時間の基本設定：{c['minecraft:cooldown']['duration']}秒。装備などによる補正は別です。")
    matches = next((p for root in roots if (p := loot_path(root, identifier))), None)
    obtaining = '個別の入手経路は確認中です。名前からドロップ元や製作方法を推測していません。'
    if matches:
        paths.extend(matches)
        obtaining = 'ボスチェスト報酬の抽選候補に含まれます。毎回の入手や、すべてのボスからの入手を保証するものではありません。'
    entry = add(slug, title, 'item', summary, description, usage, obtaining, details, paths,
                {'src': f'/images/items/{slug}.png', 'alt': title + 'のパック内画像', 'kind': 'pack-texture'})
    g['entries'].append(slug); selected[identifier] = entry
    return c

melee = group('melee', '近接武器', '剣、斧、鎌、槍。武器ごとの見た目と基礎設定から、お気に入りを探そう。')
for relative, family in [
    ('longsword/sword.json','ロングソード'), ('longsword/sword_diamond.json','ロングソード'),
    ('claymore/claymore_heartstealer.json','クレイモア'), ('katana/katana_masters.json','刀'),
    ('gauntlets/gauntlets_fighters_bindings.json','ガントレット'), ('double_axe/double_cursed.json','両刃斧'),
    ('double_axe/double_whirlwind.json','両刃斧'), ('hammer/hammer_stormlander.json','ハンマー'),
    ('sickles/sickles.json','鎌'), ('sickles/nightmares_bite.json','鎌'),
    ('mace/flail.json','メイス'), ('rush_spear/rush_spear.json','槍'),
    ('rush_spear/whispering_spear.json','槍'), ('obsidian_claymore/obsidian_starless_night.json','黒曜石の大剣'),
    ('anchor/anchor_encrusted.json','錨'), ('battlestaff/battlestaff_growing.json','バトルスタッフ')]:
    item('melee/'+relative, melee, family+'系列の近接装備。',
         family+'系列の武器です。個別画像と耐久値、近接ダメージ成分を比較できます。',
         '手に持って近接戦闘に使う装備です。特殊効果や実際の攻撃間隔はゲーム内での確認が残っています。')
melee['entries'].insert(0, 'hawkbrand')

ranged = group('ranged', '弓・クロスボウ', '離れた相手に備える装備。弾薬と引き絞りの設定も確認できます。')
for relative in ['bow/power_bow/power_bow.json','bow/power_bow/elite_power_bow.json',
                 'bow/bubble/bubble_bow.json','bow/bubble/bubble_burster.json','bow/longbow/red_snake.json',
                 'bow/soulbow/bow_of_lost_souls.json','crossbow/scatter/harp.json',
                 'crossbow/scatter/lightning.json','crossbow/dual/dual_crossbows.json','crossbow/dual/spellbound_crossbows.json']:
    definition = read(bp/'items/ranged'/relative)['minecraft:item']['components']
    shooter = definition['minecraft:shooter']
    assert any(x['item'] == 'minecraft:arrow' for x in shooter['ammunition'])
    family = 'クロスボウ' if relative.startswith('crossbow') else '弓'
    item('ranged/'+relative, ranged, family+'系列の遠距離装備。',
         family+'として弾を撃つ装備です。通常の矢を弾薬に使う設定を確認しています。',
         '矢を用意して使用操作で狙います。追加の矢・特殊な射撃効果の動作は未検証です。',
         [f"最大引き絞り時間の設定：{shooter['max_draw_duration']}秒。"])

armor = group('armor', '防具', '英雄・勇者・フロストバイト・ファントムの4系列を、頭から足まで掲載。')
for folder, family in [('unique/hero_armour','英雄'),('common/champion_armour','勇者'),
                       ('unique/frost_bite','フロストバイト'),('common/phantom_armour','ファントム')]:
    paths = sorted((bp/'items/armor'/folder).glob('*.json')); assert len(paths) == 4
    for p in paths:
        item(p.relative_to(bp/'items').as_posix(), armor, family+'系列の防具。',
             family+'系列の4部位のうちの1つです。装備部位・耐久値・防御値の設定を確認できます。',
             '対応する防具スロットに装備します。セット効果は必要部位や処理の検証が残るため、ここでは断定していません。')

artifacts = group('artifacts', 'アーティファクト', '移動、守り、回復、仲間の召喚。通常版8種類の使い道と製作配置を紹介。')
artifact_specs = [
 ('death_cap','deathCap','dungeons:death_cap_mushroom','攻撃力と移動速度を一時的に上げる。','通常版は攻撃力上昇と移動速度上昇を200tick付与する処理です。','strength'),
 ('iron_hide','ironHide','dungeons:iron_hide_amulet','短時間の守りを補助するお守り。','通常版は耐性IIを150tick付与する処理です。','resistance'),
 ('boots_of_swiftness','swiftnessBoot','dungeons:boots_of_switfness','短時間の移動を助けるブーツ。','通常版は移動速度上昇IIを60tick付与する処理です。防具ではなく、使用するアーティファクトです。','speed'),
 ('light_feather','lightFeather','dungeons:light_feather','向いている方向へ飛び出す羽根。','使用者に移動の力を加え、近くの有効な対象へ短時間の鈍足を付ける処理です。','applyKnockback'),
 ('totem_of_regeneration','totemRegeneration','dungeons:totem_of_regeneration','周囲の回復を補助するトーテム。','トーテムを呼び出し、回復イベントで周囲のプレイヤーの体力を戻す処理です。所有者への回復増量は断定していません。','dungeons:heal'),
 ('tasty_bone','tastyBone','dungeons:tasty_bone','ペットのオオカミを呼び出す骨。','使用者の位置へ専用のオオカミを呼び出し、使用者になつかせる処理です。','dungeons:pet_wolf'),
 ('golem_kit','golemKit','dungeons:golem_kit','ペットのゴーレムを呼び出す道具。','使用者の位置へ専用のアイアンゴーレムを呼び出し、使用者になつかせる処理です。','dungeons:pet_iron_golem'),
 ('ghost_cloak','ghostCloak','dungeons:ghost_cloak','一時的に姿を隠して移動を補助する。','通常版は移動速度上昇・耐性II・透明化を40tick付与する処理です。壁抜けや完全な無敵を保証する効果ではありません。','invisibility')]
for filename, scriptname, component, summary, description, token in artifact_specs:
    script = bp/f'scripts/components/artefacts/{scriptname}.js'; code = script.read_text(encoding='utf-8')
    assert component in code and token in code
    c = read(bp/f'items/artifact/common/{filename}.json')['minecraft:item']['components']; assert component in c
    item(f'artifact/common/{filename}.json', artifacts, summary, description,
         '手に持って使用します。記載は通常版のコード設定で、実際の操作・効果・持続時間はゲーム内未検証です。',
         ['時間は20tickで1秒を基準とした設定です。処理負荷による実時間の差は未検証です。'], [script])

craft = group('crafting', '英雄の書・素材・レシピ', 'まず英雄の書を用意。ダイヤモンドの粉を材料に、アーティファクト作りへ。')
craft['entries'].append('book-of-heroes')
for relative, summary, description in [
 ('diamond_dust.json','アーティファクト製作に使う素材。','ダイヤモンドブロックとウサギの皮から作る素材です。今回掲載した通常版アーティファクトの製作材料にも使います。'),
 ('blueprint.json','紙とダイヤモンドの粉から作る設計図。','青色の設計図の製作配置を紹介します。具体的な装備の強化手順は、別途確認してから掲載します。')]:
    item(relative, craft, summary, description, '関連レシピの材料と配置を確認して製作に使います。')
book = next(e for e in records if e['id'] == 'book-of-heroes')
selected['dungeons:book_of_heroes'] = book
book.update(summary='装備の収集状況を確認する冒険の図鑑。', description='近接武器・遠距離武器・防具・アーティファクトを調べるためのゲーム内の本です。収集状況や装備情報を開く画面が実装されています。', usage='手に持って「読む」の使用操作で開きます。収集通知や画面表示の実機確認は残っています。')
book['evidence'] = proof([bp/'items/book_of_heroes.json', bp/'scripts/components/other/theBookOfHeroes.js', bp/'scripts/misc/bookOfHeroesCollection.js', langpath])

vanilla = {'gold_ingot':'金インゴット','book':'本','paper':'紙','diamond_block':'ダイヤモンドブロック','rabbit_hide':'ウサギの皮',
           'sugar':'砂糖','feather':'羽根','leather_boots':'革のブーツ','blaze_powder':'ブレイズパウダー','red_mushroom':'赤いキノコ',
           'iron_block':'鉄ブロック','emerald_block':'エメラルドブロック','bone':'骨','rotten_flesh':'腐った肉',
           'iron_ingot':'鉄インゴット','pumpkin':'カボチャ','carved_pumpkin':'くり抜かれたカボチャ','totem_of_undying':'不死のトーテム',
           'gold_block':'金ブロック','ghast_tear':'ガストの涙','ender_pearl':'エンダーパール','phantom_membrane':'ファントムの皮膜',
           'slime_ball':'スライムボール','wool':'羊毛','leather':'革','poppy':'ポピー','honey_bottle':'ハチミツ入りの瓶',
           'amethyst_shard':'アメジストの欠片','golden_dandelion':'金色のタンポポ（仮訳）','stick':'棒'}
def ingredient(value):
    identifier = value['item']
    if identifier.startswith('dungeons:'): return name(identifier)
    return vanilla[identifier.removeprefix('minecraft:')]
recipe_count = 0
for p in sorted((bp/'recipes').rglob('*.json')):
    d = read(p).get('minecraft:recipe_shaped')
    if not d or not isinstance(d['result'], dict) or d['result']['item'] not in selected: continue
    target = selected[d['result']['item']]
    if target['id'] not in artifacts['entries'] + craft['entries']: continue
    assert d['tags'] == ['crafting_table']
    keys = {key: ingredient(value) for key, value in d['key'].items()}
    grid = [[keys.get(char, '') for char in row] for row in d['pattern']]
    amounts = Counter(x for row in grid for x in row if x)
    recipe = dict(shaped=True, grid=grid, ingredients=[dict(name=k,count=v) for k,v in amounts.items()], resultId=target['id'],count=d['result'].get('count',1))
    slug = target['id'] + '-recipe'
    add(slug, target['name']+'のレシピ', 'recipe', target['name']+'を作る材料と配置。',
        '作業台の配置付きレシピです。材料の個数と完成数を確認できます。', '作業台で下の配置どおりに材料を並べます。',
        '製作レシピの定義を確認しています。実際のワールドでの解放表示と製作は未検証です。', [], [p, langpath], recipe=recipe)
    target['obtaining'] = '作業台で製作するレシピがあります。関連レシピから材料・配置・完成数を確認できます。'
    target['evidence']['paths'].append(p.relative_to(repo).as_posix())
    craft['entries'].append(slug); recipe_count += 1
assert recipe_count == 11, recipe_count

adventure = group('adventure', '冒険と収集の手がかり', '図鑑で装備を調べ、製作とボス報酬を次の目標に。')
for slug, title, summary, description, usage, obtaining, details, paths in [
 ('dungeons-collection','英雄の書とコレクション','集めた装備をゲーム内の本で確認。','英雄の書には近接・遠距離・防具・アーティファクトの分類と収集状況を表示する画面があります。インベントリ変更から収集を記録する処理も確認できます。','英雄の書を製作して使用します。未収集品と収集済み品の画面や通知は実機での確認が残っています。','本1冊と金インゴット4個から製作できます。',[],[bp/'scripts/components/other/theBookOfHeroes.js',bp/'scripts/misc/bookOfHeroesCollection.js',bp/'recipes/book_of_heroes.json']),
 ('dungeons-boss-rewards','ボスチェストの報酬','武器、防具、アーティファクトを集める手がかり。','14種類のボスチェスト報酬テーブルがあります。通常の近接・遠距離・アーティファクト枠に加え、防具や製作素材などの抽選が設定されています。','アイテムの図鑑で、ボス報酬の候補に含まれるか確認できます。抽選を繰り返しても同じ装備が選ばれることがあります。','鍵の入手条件、ボスの出現場所、チェストを開く実操作は今回未検証です。',['防具枠からはDungeons装備のほか、バニラ防具を選ぶ場合があります。','ハロウィンなどは枠構成が異なります。全ボスが同じ報酬になるわけではありません。','確定ドロップやフルセット入手を約束する紹介ではありません。'],roots),
 ('dungeons-artifact-crafting','アーティファクトの製作','素材を集めて、冒険を支える道具を作る。','ダイヤモンドの粉と、作りたい道具ごとの材料を使います。今回は通常版8種類の製作配置を掲載しています。','まずダイヤモンドの粉のレシピを確認し、各アーティファクトの関連レシピへ進んでください。','粉はダイヤモンドブロック1個とウサギの皮3個から1個製作する定義です。',['通常版とレア版を混同せず、掲載レシピの完成品を確認してください。'],[bp/'recipes/diamond_dust.json',bp/'recipes/artefacts/death_cap_mushroom.json'])]:
    add(slug,title,'feature',summary,description,usage,obtaining,details,paths); adventure['entries'].append(slug)

contents = read(web/'src/data/content-registry.json')
content = next(c for c in contents['contents'] if c['id'] == 'minecraft-dungeons')
content.update(summary='装備を集め、道具を作り、強敵との冒険へ。',
    description='多彩な近接武器、弓とクロスボウ、4部位の防具、冒険を支えるアーティファクトを楽しむコンテンツです。英雄の書で収集状況を調べ、素材から道具を作り、ボスチェストの報酬を次の装備集めにつなげられます。ここでは現行コードと照合した装備・レシピを種類別に紹介します。',
    implementation='implemented', deployment='deployed-recorded',
    highlights=['近接・遠距離の装備を、実際のアイテム画像で比較。','英雄・勇者・フロストバイト・ファントムの防具を4部位ずつ紹介。','通常版アーティファクト8種類の用途と、素材を含む11件の製作配置。','英雄の書による収集と、14種類のボスチェスト報酬設定。'],
    guide='はじめは本と金インゴットで英雄の書を製作。装備の収集状況を調べながら、ダイヤモンドの粉を使ったアーティファクト作りへ進めます。以下の種類別一覧から、使いたい道具の説明と関連レシピを開いてください。')
content['evidence'] = proof([bp/'manifest.json',rp/'manifest.json',bp/'scripts/components/other/theBookOfHeroes.js',repo/'docs/deployments/2026-09-09-dungeons-2.0.3-ja.md',*roots])
for v in content['verification']:
    if v['kind'] == 'server-start': v.update(result='confirmed',commit=sha)
content['packBindings'][0]['roles'] = ['behavior','item-definition','runtime-script','recipe','loot']
for path, data in [(web/'src/data/field-guide.json',records),(web/'src/data/content-registry.json',contents),(web/'src/data/dungeons-guide.json',groups)]:
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Dungeons entries: {sum(e["contentId"]=="minecraft-dungeons" for e in records)}; total: {len(records)}; recipes: {recipe_count}')
