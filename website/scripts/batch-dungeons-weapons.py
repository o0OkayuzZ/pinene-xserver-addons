"""Stage remaining Dungeons weapons from immutable Git objects; never modify game files.

The baseline is pinned so this script remains reproducible after the staged entries
are merged into the live guide. Only this batch JSON and its item images are written.
"""
import json
import re
import subprocess
from collections import Counter
from functools import lru_cache
from pathlib import Path

web = Path(__file__).resolve().parents[1]
repo = web.parent
revision = '3b66fddebe8006ea5f3656d509bf833d7594a09f'
baseline = '90cae3be44968b6a0da952261cc4736e0fd532cf'


def git(*args):
    return subprocess.check_output(['git', '-c', 'core.quotepath=false', *args], cwd=repo)


@lru_cache(None)
def raw(path):
    return git('show', revision + ':' + path)


@lru_cache(None)
def source(path):
    return json.loads(raw(path).decode('utf-8-sig'))


tree = set(git('ls-tree', '-r', '--name-only', revision).decode('utf-8').splitlines())
bp = next(p.rsplit('/', 1)[0] for p in tree if p.startswith('behavior_packs/bp_08_') and p.endswith('/manifest.json'))
rp = next(p.rsplit('/', 1)[0] for p in tree if p.startswith('resource_packs/rp_06_') and p.endswith('/manifest.json'))
base = json.loads(git('show', baseline + ':website/src/data/field-guide.json').decode('utf-8'))
existing = {e['id'] for e in base}
covered = {p for e in base if e['kind'] == 'recipe' for p in e['evidence']['paths']}
langpath = rp + '/texts/ja_JP.lang'
atlaspath = rp + '/textures/item_texture.json'
lang = dict(line.split('=', 1) for line in raw(langpath).decode('utf-8').splitlines() if '=' in line)
atlas = source(atlaspath)['texture_data']
vanilla = dict(iron_ingot='鉄インゴット', iron_block='鉄ブロック', iron_nugget='鉄塊',
               stick='棒', string='糸', gold_ingot='金インゴット', obsidian='黒曜石',
               leather='革', basalt='玄武岩', bone_block='骨ブロック', copper_ingot='銅インゴット',
               brain_coral='脳サンゴ', smooth_stone='滑らかな石', crying_obsidian='泣く黒曜石',
               popped_chorus_fruit='焼いたコーラスフルーツ', ender_pearl='エンダーパール',
               tripwire_hook='トリップワイヤーフック', tnt='TNT', gunpowder='火薬',
               chorus_fruit='コーラスフルーツ', packed_ice='氷塊', soul_torch='魂のたいまつ',
               soul_sand='ソウルサンド', twisting_vines='ねじれツタ', feather='羽根',
               arrow='矢', cobblestone='丸石')


def label(identifier):
    if not identifier.startswith('dungeons:'):
        return vanilla[identifier.removeprefix('minecraft:')]
    value = lang.get('item.' + identifier) or lang.get('item.' + identifier + '.name') or lang.get('tile.' + identifier + '.name')
    assert value, identifier
    return re.sub(r'[\ue000-\uf8ff]', '', re.sub(r'§.', '', value)).strip()


def slug(identifier):
    return 'hawkbrand' if identifier == 'dungeons:hawkbrand' else 'dungeons-' + identifier.split(':')[1].replace('_', '-')


def evidence(paths):
    assert all(p in tree for p in paths), paths
    return dict(commit=revision, paths=list(dict.fromkeys(paths)))


recipe_paths = sorted(p for p in tree if p.endswith('.json') and
                      (p.startswith(bp + '/recipes/weapon/') or p.startswith(bp + '/recipes/ranged/')))
missing_recipes = [p for p in recipe_paths if p not in covered]
recipes_by_item = {}
for path in missing_recipes:
    definition = source(path)
    key = next(k for k in definition if k.startswith('minecraft:recipe_'))
    recipe = definition[key]
    # All remaining weapon recipes produce a single base item, not a blueprint copy.
    assert key == 'minecraft:recipe_shaped' and isinstance(recipe['result'], dict)
    identifier = recipe['result']['item']
    assert identifier not in recipes_by_item
    recipes_by_item[identifier] = (path, recipe)

entries = []
group_entries = {key: [] for key in ['melee', 'ranged', 'melee-recipes', 'ranged-recipes']}
excluded = []
excluded_recipes = []
accounted = []
items_by_identifier = {}
item_paths = sorted(p for p in tree if p.endswith('.json') and
                    (p.startswith(bp + '/items/melee/') or p.startswith(bp + '/items/ranged/')))

for path in item_paths:
    definition = source(path)['minecraft:item']
    identifier = definition['description']['identifier']
    entry_id = slug(identifier)
    if entry_id in existing:
        accounted.append(dict(identifier=identifier, path=path, status='previously-published'))
        continue
    if '/unobtainable/' in path:
        reason = ('unobtainable配下。単独のloot_tables/whatt.jsonへの登録はありますが、通常プレイからこの表を使う経路を確認できません。'
                  if identifier == 'dungeons:alylicleaver' else
                  'unobtainable配下。料理人ヴィンディケーターの装備用テーブルにありますが、プレイヤーが取得できるドロップ経路は未確認です。')
        excluded.append(dict(identifier=identifier, reason=reason, paths=[path]))
        accounted.append(dict(identifier=identifier, path=path, status='excluded'))
        continue
    components = definition['components']
    title = label(identifier)
    texture = atlas[components['minecraft:icon']]['textures']
    assert isinstance(texture, str)
    imagepath = rp + '/' + texture + '.png'
    (web / 'public/images/items' / (entry_id + '.png')).write_bytes(raw(imagepath))
    paths = [path, langpath, atlaspath, imagepath]
    durability = components['minecraft:durability']['max_durability']
    details = [f'耐久値の設定：{durability}。']
    ranged = '/items/ranged/' in path
    group = 'ranged' if ranged else 'melee'
    family = 'クロスボウ' if '/crossbow/' in path else '弓'
    if ranged:
        shooter = components['minecraft:shooter']
        draw = shooter['max_draw_duration']
        ammo = [label(a['item']) for a in shooter['ammunition']]
        assert '矢' in ammo
        details += [f'最大引き絞り時間の設定：{draw}秒。', '対応弾薬：' + '、'.join(ammo) + '。']
        description = f'{family}として矢を撃つ装備です。最大引き絞り時間は{draw}秒、耐久値は{durability}に設定されています。通常の矢と5種類の特殊な矢が弾薬候補に含まれます。'
        summary = f'引き絞り{draw}秒・耐久値{durability}の{family}。'
        usage = '対応する矢を用意し、使用操作で狙います。射撃時の追加効果、弾道、最終ダメージはゲーム内で未検証です。'
    else:
        component_damage = components['minecraft:damage']
        damage = component_damage['value'] if isinstance(component_damage, dict) else component_damage
        details.append(f'近接ダメージ成分の設定値：{damage}。特殊攻撃や相手の防御を含む最終ダメージではありません。')
        summary = f'耐久値{durability}・ダメージ成分{damage}の近接装備。'
        description = f'{title}のアイテム画像、基礎性能と修理材料を確認できます。耐久値は{durability}、近接ダメージ成分は{damage}に設定されています。'
        usage = '手に持って近接戦闘に使う装備です。特殊効果や連続攻撃、実際の攻撃間隔はゲーム内で未検証です。'
        if 'minecraft:cooldown' in components:
            details.append(f"攻撃クールダウンの設定：{components['minecraft:cooldown']['duration']}秒。")
        if 'minecraft:swing_duration' in components:
            details.append(f"振り動作の時間設定：{components['minecraft:swing_duration']['value']}秒。")
        if identifier == 'dungeons:glaive':
            reach = components['minecraft:piercing_weapon']['reach']
            details.append(f"突き攻撃の通常射程設定：最小{reach['min']}・最大{reach['max']}。実際の当たり判定は未検証です。")
        if identifier == 'dungeons:sharpened_pickaxe':
            speeds = components['minecraft:digger']['destroy_speeds']
            assert speeds[0]['speed'] == 6
            details.append('ツルハシの破壊対象タグを持つブロックに、採掘速度6が設定されています。すべてのブロックへの適用を意味しません。')
    for repair in components.get('minecraft:repairable', {}).get('repair_items', []):
        names = '、'.join(label(i) for i in repair['items'])
        amount = repair['repair_amount']
        proportion = re.fullmatch(r'(?:q|query)\.max_durability\*(0\.\d+)', amount)
        if proportion:
            percent = float(proportion[1]) * 100
            details.append(f'修理材料の設定：{names}。1個あたり最大耐久値の{percent:g}%に相当する修復量です。')
        else:
            details.append(f'同じ系列の装備を使う修理設定：{names}。修復量は材料側の残り耐久値などで変わります。')
    details.append('修理操作、特殊効果、実ワールドでの動作は未検証です。')
    if identifier == 'dungeons:sparkler':
        eventpath = bp + '/scripts/misc/sparklerLoot.js'
        mainpath = bp + '/scripts/main.js'
        event = raw(eventpath).decode('utf-8')
        assert 'import "./misc/sparklerLoot.js";' in raw(mainpath).decode('utf-8')
        assert all(t in event for t in ['month == 5 && date >= 18', 'month == 6 && date <= 3',
                                      'Math.random() > 1 / 3', 'dungeons:diamond_chest', 'dungeons:sparkler'])
        paths.extend([eventpath, mainpath])
        summary = '期間限定のチェスト開封処理に登録された近接装備。'
        description += ' 季節限定アイテムのタグと、期間を判定する専用の入手処理があります。'
        obtaining = '実行環境の日付が6月18日〜7月3日のとき、Dungeonsのダイヤモンドチェスト開封イベントで約3分の1の抽選を行い、当選時に1個を生成するコードがあります。現在の本番での開催・取得は未確認です。'
        details.append('判定には実行環境のDateが使われます。日本時間での開始・終了や、現在の配布を保証しません。')
    else:
        assert identifier in recipes_by_item, identifier
        recipepath, recipe = recipes_by_item[identifier]
        paths.append(recipepath)
        obtaining = '作業台用の素材レシピが登録されています。関連レシピで材料の個数、配置と完成数を確認できます。実際の製作・解放表示は未検証です。'
    item = dict(id=entry_id, name=title, kind='item', contentId='minecraft-dungeons',
                summary=summary, description=description, usage=usage, obtaining=obtaining, details=details,
                image=dict(src='/images/items/' + entry_id + '.png', alt=title + 'のパック内画像', kind='pack-texture'),
                recipe=None, visibility='public', evidence=evidence(paths))
    entries.append(item)
    items_by_identifier[identifier] = item
    group_entries[group].append(entry_id)
    accounted.append(dict(identifier=identifier, path=path, status='added'))

for identifier, (path, recipe) in sorted(recipes_by_item.items()):
    assert recipe['tags'] == ['crafting_table']
    target = items_by_identifier[identifier]
    keys = {k: label(v['item']) for k, v in recipe['key'].items()}
    assert all(set(v) == {'item'} for v in recipe['key'].values())
    pattern = recipe['pattern']
    assert all(c == ' ' or c in keys for row in pattern for c in row)
    details = []
    extra_paths = []
    if identifier == 'dungeons:void_bow':
        voidpath = bp + '/blocks/void_fluid.json'
        assert source(voidpath)['minecraft:block']['description']['identifier'] == 'dungeons:void_fluid'
        details.append('材料の「ヴォイド」はブロックとして定義されています。通常プレイでの材料の入手経路は未確認です。')
        extra_paths.append(voidpath)
    if len({len(row) for row in pattern}) != 1:
        assert identifier == 'dungeons:rapier', path
        target['obtaining'] = '作業台用レシピの定義はありますが、行幅に不整合があります（上から3・3・2文字）。ゲーム内での製作可否が未確認のため、製作可能なレシピとしては掲載していません。'
        excluded_recipes.append(dict(path=path, identifier=identifier, reason='レシピ配置の行幅が3・3・2文字と不揃い。ゲーム内での製作可否が未確認のため、元定義を補正して公開しない。'))
        continue
    grid = [[keys.get(c, '') for c in row] for row in pattern]
    counts = Counter(name for row in grid for name in row if name)
    count = recipe['result'].get('count', 1)
    assert count == 1
    entry_id = target['id'] + '-recipe'
    assert entry_id not in existing
    entry = dict(id=entry_id, name=target['name'] + 'のレシピ', kind='recipe', contentId='minecraft-dungeons',
                 summary=target['name'] + 'を1個作る素材と配置。',
                 description='作業台用の素材レシピです。元になる同じ装備や青色の設計図を使わず、掲載された素材を組み合わせる定義になっています。',
                 usage='作業台で下の配置どおりに材料を並べます。',
                 obtaining='最新版リポジトリのレシピ定義を確認しています。実際の製作・解放表示は未検証です。',
                 details=details, image=None,
                 recipe=dict(shaped=True, grid=grid, ingredients=[dict(name=k, count=v) for k, v in counts.items()],
                             resultId=target['id'], count=count), visibility='public',
                 evidence=evidence([path, target['evidence']['paths'][0], langpath, *extra_paths]))
    entries.append(entry)
    group_entries['ranged-recipes' if '/recipes/ranged/' in path else 'melee-recipes'].append(entry_id)

assert len(group_entries['melee']) == 25
assert len(group_entries['ranged']) == 14
assert len(group_entries['melee-recipes']) == 23
assert len(group_entries['ranged-recipes']) == 14
assert len(excluded) == 2
assert len({e['id'] for e in entries}) == len(entries) == 76
assert len(accounted) == len(item_paths) == 137
assert len({e['identifier'] for e in accounted}) == len(accounted)
assert {p for p in missing_recipes} == {p for e in entries if e['kind'] == 'recipe' for p in e['evidence']['paths'] if '/recipes/' in p} | {e['path'] for e in excluded_recipes}
result = dict(sourceCommit=revision, baselineWebCommit=baseline, entries=entries,
              groupEntries=group_entries, excluded=excluded, excludedRecipes=excluded_recipes,
              accountedItems=accounted, coveredRecipePaths=recipe_paths)
(web / 'artifacts/batch-weapons.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps(dict(added=len(entries), groups={k: len(v) for k, v in group_entries.items()},
                     excluded=len(excluded), accountedItemDefinitions=len(accounted),
                     accountedRecipeFiles=len(recipe_paths), excludedRecipes=len(excluded_recipes)), ensure_ascii=False))
