"""Second reviewed Dungeons batch. Only website files are written."""
import json, re, shutil
from pathlib import Path
from collections import Counter
from functools import lru_cache

web=Path(__file__).resolve().parents[1];repo=web.parent
bp=next((repo/'behavior_packs').glob('bp_08_*'));rp=next((repo/'resource_packs').glob('rp_06_*'))
sha='aea85120954a8b74033b86253c17a04b691dab21'
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
records=read(web/'src/data/field-guide.json');before=len(records)
groups=read(web/'src/data/dungeons-guide.json');groupmap={g['id']:g for g in groups}
assert not any(e['id']=='dungeons-burning-arrow' for e in records),'Batch already applied'
ids={e['id'] for e in records}
langpath=rp/'texts/ja_JP.lang';atlaspath=rp/'textures/item_texture.json'
lang=dict(line.split('=',1) for line in langpath.read_text(encoding='utf-8').splitlines() if '=' in line)
atlas=read(atlaspath)['texture_data']
def name(identifier):
    value=lang.get('item.'+identifier) or lang.get('item.'+identifier+'.name')
    assert value,identifier
    return re.sub(r'[\ue000-\uf8ff]','',re.sub(r'§.','',value)).strip()
def evidence(paths):
    for p in paths:assert p.is_file(),p
    return {'commit':sha,'paths':list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
@lru_cache(None)
def rewards(path):
    found={}
    def visit(node):
        if isinstance(node,list):
            for child in node:visit(child)
        elif isinstance(node,dict):
            if node.get('weight',1)<=0:return
            if node.get('type')=='item':found.setdefault(node['name'],[path])
            if node.get('type')=='loot_table':
                target=bp/node['name']
                if target.is_file():
                    for identifier,chain in rewards(target).items():found.setdefault(identifier,[path,*chain])
            for key in ['pools','entries','children']:visit(node.get(key,[]))
    visit(read(path));return found
rewardpaths={}
for root in sorted((bp/'loot_tables/chests/diamond_chest').glob('*.json')):
    for identifier,chain in rewards(root).items():rewardpaths.setdefault(identifier,chain)
family_names=dict(anchor='錨',axe='斧',backstabber='バックスタバー',battlestaff='バトルスタッフ',boneclub='骨のこん棒',
 broken_sawblade='ソーブレード',claymore='クレイモア',coral_blade='サンゴの剣',cutlass='カトラス',daggers='ダガー',
 double_axe='両刃斧',gauntlets='ガントレット',glaive='グレイブ',hammer='ハンマー',katana='刀',longsword='ロングソード',
 mace='メイス',obsidian_claymore='黒曜石の大剣',pickaxe='戦闘用ツルハシ',rapier='レイピア',rush_spear='槍',
 scythe='大鎌',sickles='鎌',soul_knife='ソウルナイフ',tempest_knife='テンペストナイフ',void_blades='ヴォイドブレード',whip='ムチ')
vanilla={'iron_ingot':'鉄インゴット','gold_ingot':'金インゴット','diamond':'ダイヤモンド','netherite_ingot':'ネザライトインゴット',
 'string':'糸','stick':'棒','bone':'骨','copper_ingot':'銅インゴット','arrow':'矢','blaze_powder':'ブレイズパウダー','tnt':'TNT','soul_sand':'ソウルサンド'}
def item(p,group,summary,description,usage,extra=(),extra_paths=()):
    d=read(p)['minecraft:item'];identifier=d['description']['identifier'];c=d['components']
    slug='dungeons-'+identifier.split(':')[1].replace('_','-');assert slug not in ids,slug
    title=name(identifier);icon=c['minecraft:icon'];assert isinstance(icon,str)
    texture=atlas[icon]['textures'];assert isinstance(texture,str)
    source=rp/(texture+'.png');assert source.is_file(),source
    shutil.copyfile(source,web/f'public/images/items/{slug}.png')
    paths=[p,langpath,atlaspath,source,*extra_paths];details=list(extra)
    if 'minecraft:durability' in c:details.append(f"耐久値の設定：{c['minecraft:durability']['max_durability']}。")
    if 'minecraft:damage' in c:
        damage=c['minecraft:damage'];value=damage['value'] if isinstance(damage,dict) else damage
        details.append(f'近接ダメージ成分の設定値：{value}。特殊攻撃や相手の防御を含む最終ダメージではありません。')
    if 'minecraft:wearable' in c:
        w=c['minecraft:wearable'];slot={'slot.armor.head':'頭','slot.armor.chest':'胴','slot.armor.legs':'脚','slot.armor.feet':'足'}[w['slot']]
        details.append(f"装備部位：{slot}。防御値の設定：{w['protection']}。")
    repairs=[]
    for rule in c.get('minecraft:repairable',{}).get('repair_items',[]):
        for repairid in rule['items']:
            if repairid.startswith('dungeons:'):repairs.append(name(repairid))
            elif repairid.removeprefix('minecraft:') in vanilla:repairs.append(vanilla[repairid.removeprefix('minecraft:')])
    if repairs:details.append('修理材料の設定に含まれるもの：'+'、'.join(dict.fromkeys(repairs))+'。修復量や操作はゲーム内で未検証です。')
    obtaining='個別の入手経路は確認中です。名前から入手先を推測していません。'
    if identifier in rewardpaths:
        paths.extend(rewardpaths[identifier]);obtaining='ボスチェスト報酬の抽選候補に含まれます。確定入手や、すべてのボスからの入手を保証するものではありません。'
    entry=dict(id=slug,name=title,kind='item',contentId='minecraft-dungeons',summary=summary,description=description,
        usage=usage,obtaining=obtaining,details=details,image={'src':f'/images/items/{slug}.png','alt':title+'のパック内画像','kind':'pack-texture'},
        recipe=None,visibility='public',evidence=evidence(paths))
    records.append(entry);ids.add(slug);groupmap[group]['entries'].append(slug);return entry

skipped=[]
for family in ['melee','ranged/bow','ranged/crossbow']:
    for p in sorted((bp/'items'/family).rglob('*.json')):
        d=read(p)['minecraft:item'];identifier=d['description']['identifier'];slug='dungeons-'+identifier.split(':')[1].replace('_','-')
        if slug in ids or identifier=='dungeons:hawkbrand':continue
        # Unobtainable/seasonal definitions are not promoted just to increase counts.
        if 'unobtainable' in p.parts or identifier not in rewardpaths:skipped.append(identifier);continue
        if family=='melee':
            label=family_names[p.parent.name]
            item(p,'melee',label+'系列の近接装備。',label+'系列の1本です。実際のアイテム画像と、耐久・ダメージ成分・修理材料の設定を比較できます。',
                '手に持って近接戦闘に使います。特殊効果や連続攻撃の実際の動作は未検証です。')
        else:
            c=d['components'];shooter=c['minecraft:shooter'];assert any(a['item']=='minecraft:arrow' for a in shooter['ammunition'])
            label='弓' if family.endswith('/bow') else 'クロスボウ'
            item(p,'ranged',label+'系列の遠距離装備。',label+'として矢を撃つ装備です。通常の矢への対応と引き絞り、耐久、修理材料の設定を確認しています。',
                '矢を用意し、使用操作で狙います。追加効果や特殊な矢の実際の挙動は未検証です。',
                [f"最大引き絞り時間の設定：{shooter['max_draw_duration']}秒。"])

for folder,label in [('common/beenest','ハチの巣'),('unique/beehive','ハチの巣箱'),('common/soul_robe','ソウルローブ'),
 ('common/souldancer_robe','ソウルダンサーローブ'),('common/wolf_armour','オオカミ'),('unique/fox_armour','キツネ'),
 ('unique/spider_armour','クモ'),('unique/wither','ウィザー')]:
    files=sorted((bp/'items/armor'/folder).glob('*.json'));assert len(files)==4
    for p in files:item(p,'armor',label+'系列の防具。',label+'系列の4部位のうちの1つです。各部位の防御値・耐久値と修理材料を確認できます。',
        '対応する防具スロットへ装備します。召喚や回復などのセット効果は、名前から推測して掲載していません。')

ammo=dict(id='ammunition',title='特殊な矢とレシピ',intro='弓・クロスボウに備える5種類の弾薬。配置自由のレシピと、種類ごとに異なる完成数を確認。',entries=[])
groups.insert(2,ammo);groupmap['ammunition']=ammo
entities={read(p).get('minecraft:entity',{}).get('description',{}).get('identifier'):p for p in (bp/'entities').rglob('*.json')}
for p in sorted((bp/'items/ranged/arrows').glob('*.json')):
    d=read(p)['minecraft:item'];identifier=d['description']['identifier'];projectile=d['components']['minecraft:projectile']['projectile_entity']
    assert projectile in entities
    compatible=[]
    for weapon in (bp/'items/ranged').rglob('*.json'):
        w=read(weapon)['minecraft:item']
        if any(a['item']==identifier for a in w['components'].get('minecraft:shooter',{}).get('ammunition',[])):compatible.append(weapon)
    assert compatible
    recipepath=bp/'recipes'/p.name;r=read(recipepath)['minecraft:recipe_shapeless'];assert r['result']['item']==identifier and r['tags']==['crafting_table']
    entry=item(p,'ammunition','対応する遠距離装備に使う弾薬。','通常の矢と素材を組み合わせて作る特殊な矢です。弾薬への対応と発射先の定義を確認しています。',
        '対応する弓・クロスボウの弾薬として使います。見た目から炎・雷・貫通などの発動条件や威力を断定していません。',
        ['弾薬候補に含まれる装備の例：'+name(read(compatible[0])['minecraft:item']['description']['identifier'])+'。'],[recipepath,entities[projectile],compatible[0]])
    entry['obtaining']='作業台の配置自由レシピで製作します。関連レシピで材料の個数と完成数を確認できます。'
    counts=Counter()
    for ingredient in r['ingredients']:counts[vanilla[ingredient['item'].removeprefix('minecraft:')]]+=ingredient.get('count',1)
    slug=entry['id']+'-recipe';count=r['result']['count']
    records.append(dict(id=slug,name=entry['name']+'のレシピ',kind='recipe',contentId='minecraft-dungeons',summary=f"{entry['name']}を{count}個作る、配置自由のレシピ。",
        description='材料の種類と個数をそろえて製作するレシピです。矢の種類によって完成数が異なります。',usage='作業台で材料を配置自由に組み合わせます。',
        obtaining='レシピ定義を確認しています。実際のワールドでの製作・解放表示は未検証です。',details=[],image=None,
        recipe=dict(shaped=False,grid=[],ingredients=[dict(name=k,count=v) for k,v in counts.items()],resultId=entry['id'],count=count),visibility='public',evidence=evidence([recipepath])))
    ammo['entries'].append(slug)

groupmap['armor']['intro']='英雄・勇者・フロストバイト・ファントムに加え、ハチ、ソウル、動物、ウィザー系列を4部位ずつ掲載。'
contentfile=web/'src/data/content-registry.json';contents=read(contentfile);content=next(c for c in contents['contents'] if c['id']=='minecraft-dungeons')
content['highlights'][1]='12系列・48部位の防具を、実際のアイテム画像で比較。'
content['highlights'].append('5種類の特殊な矢と、配置自由の製作レシピ。')
for path,data in [(web/'src/data/field-guide.json',records),(web/'src/data/dungeons-guide.json',groups),(contentfile,contents)]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'added':len(records)-before,'total':len(records),'dungeons':sum(e['contentId']=='minecraft-dungeons' for e in records),'groups':{g['id']:len(g['entries']) for g in groups},'excluded':skipped},ensure_ascii=False))
