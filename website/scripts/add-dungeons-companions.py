"""Third reviewed Dungeons batch. Only website files are written."""
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

assert 'dungeons-enchanted-grass' not in ids,'Batch already applied'
for folder,label in [('dark_armour','ダーク'),('emerald_gear','エメラルド'),('entertainer_garb','芸人'),
 ('evocation_robes','エヴォケーションローブ'),('grim_armour','不気味'),('guard_armour','衛兵'),
 ('ocelot_armour','ヤマネコ'),('piglin_armour','ピグリン'),('plate_armour','プレート'),
 ('root_rot_armour','根腐れ'),('shulker_armour','シュルカー'),('snow_armour','スノー'),
 ('sprout_armour','芽生え'),('squid_armour','イカ'),('teleportation_robes','テレポーテーションローブ'),('thief_armour','盗人')]:
    files=sorted((bp/'items/armor/common'/folder).glob('*.json'));assert len(files)==4
    for p in files:
        item(p,'armor',label+'系列の防具。',label+'系列の頭・胴・脚・足のうちの1部位です。画像、装備部位、防御値、耐久値、修理材料を比較できます。',
             '対応する防具スロットに装備します。セット効果や敵からの狙われ方などは、名称から推測していません。')

entities={read(p).get('minecraft:entity',{}).get('description',{}).get('identifier'):p for p in (bp/'entities').rglob('*.json')}
specs=[
 ('enchanted_grass','enchantedGrass','専用のヒツジを呼び出す草。','使用者の位置に専用のヒツジを1体呼び出し、使用者になつかせる処理です。','dungeons:enchanted_sheep',[]),
 ('wonderful_wheat','wonderfulWheat','ペットのラマを呼び出す小麦。','使用者の位置に専用のラマを1体呼び出し、使用者になつかせる処理です。','dungeons:pet_llama',[]),
 ('buzzy_nest','buzzyNest','ハチを呼び出す巣を置く道具。','使用者にひも付いた専用の巣を呼び出します。巣のイベントからペットのハチを呼び出し、同じ所有者になつかせる処理があります。','dungeons:buzzy_nest',['ハチの発生間隔・同時数・実際の存続時間は未検証です。']),
 ('vexing_chant','vexingChant','3か所に守護ヴェックスを呼び出す本。','使用者の周囲3か所へ専用のヴェックスを呼び出し、使用者になつかせる処理です。','dungeons:guardian_vex',['3か所への召喚処理を確認しています。地形ごとの成功や戦闘中の挙動は未検証です。']),
 ('soul_lantern','soulLantern','ソウルを使って仲間を呼び出すランタン。','ソウルゲージが13以上あるときに13を消費し、専用のソウルウィザードを呼び出して使用者になつかせる処理です。','dungeons:soul_wizard',['ソウル不足時は召喚せず、ソウルを集めるよう案内する処理があります。','ソウルの獲得手段やゲージ表示の実機確認は残っています。']),
 ('wind_horn','windHorn','周囲の対象を押し返すホルン。','使用者から7ブロック以内の有効な対象を外側へ押し返し、鈍足を付与する処理です。通常版とレア版では押し返す力の設定が異なります。',None,['今回の掲載は通常版です。対象ごとの有効・無効や実際の飛距離は未検証です。'])]
vanilla.update(lapis_lazuli='ラピスラズリ',amethyst_shard='アメジストの欠片',grass='草ブロック',hay_block='干草の俵',
 golden_dandelion='金色のタンポポ（仮訳）',honey_bottle='ハチミツ入りの瓶',honeycomb='ハニカム',bee_nest='ミツバチの巣',
 end_rod='エンドロッド',paper='紙',soul_lantern='魂のランタン（バニラ）',feather='羽根',goat_horn='ヤギの角笛')
recipes={}
for p in (bp/'recipes').rglob('*.json'):
    r=read(p).get('minecraft:recipe_shaped',{});out=r.get('result')
    if isinstance(out,dict):recipes.setdefault(out['item'],[]).append((p,r))
for key,scriptname,summary,description,entity,details in specs:
    path=bp/f'items/artifact/common/{key}.json';d=read(path)['minecraft:item'];identifier=d['description']['identifier'];c=d['components']
    script=bp/f'scripts/components/artefacts/{scriptname}.js';code=script.read_text(encoding='utf-8');assert identifier in c and identifier in code
    sources=[script]
    if entity:
        assert entity in code and entity in entities;sources.append(entities[entity])
    if key=='buzzy_nest':
        assert 'dungeons:pet_bee' in code;sources.append(entities['dungeons:pet_bee'])
    if key=='soul_lantern':assert 'soulGauge < 13' in code and 'addScore(player, -13)' in code
    if key=='wind_horn':assert 'maxDistance: 7' in code and 'applyKnockback' in code
    details=[*details,f"基本クールダウンの設定：{c['minecraft:cooldown']['duration']}秒。装備などによる補正は別です。"]
    entry=item(path,'artifacts',summary,description,'通常版を手に持って使用します。召喚後の行動や実際の効果・操作はゲーム内で未検証です。',details,sources)
    candidates=recipes[identifier];assert len(candidates)==1
    recipepath,r=candidates[0];assert r['tags']==['crafting_table']
    keys={k:(name(v['item']) if v['item'].startswith('dungeons:') else vanilla[v['item'].removeprefix('minecraft:')]) for k,v in r['key'].items()}
    grid=[[keys.get(char,'') for char in row] for row in r['pattern']];counts=Counter(x for row in grid for x in row if x)
    slug=entry['id']+'-recipe';assert slug not in ids
    records.append(dict(id=slug,name=entry['name']+'のレシピ',kind='recipe',contentId='minecraft-dungeons',summary=entry['name']+'を作る材料と配置。',
        description='通常版アーティファクトの配置付きレシピです。ダイヤモンドの粉と、道具ごとの材料を使います。',
        usage='作業台で下の配置どおりに材料を並べます。',obtaining='レシピの定義を確認しています。実際の製作・解放表示は未検証です。',details=[],image=None,
        recipe=dict(shaped=True,grid=grid,ingredients=[dict(name=k,count=v) for k,v in counts.items()],resultId=entry['id'],count=r['result'].get('count',1)),visibility='public',evidence=evidence([recipepath,langpath])))
    groupmap['crafting']['entries'].append(slug);ids.add(slug)
    entry['obtaining']='作業台で製作するレシピがあります。関連レシピで材料の個数・配置・完成数を確認できます。'
    entry['evidence']['paths'].append(recipepath.relative_to(repo).as_posix())

groupmap['armor']['intro']='28系列・112部位の防具を掲載。見た目と、頭・胴・脚・足それぞれの設定を比較できます。'
groupmap['artifacts']['intro']='移動、守り、回復、仲間の召喚。通常版14種類の使い道と製作配置を紹介。'
contentfile=web/'src/data/content-registry.json';contents=read(contentfile);content=next(c for c in contents['contents'] if c['id']=='minecraft-dungeons')
content['highlights'][1]='28系列・112部位の防具を、実際のアイテム画像で比較。'
content['highlights'][2]='通常版アーティファクト14種類の用途と、素材を含む17件の製作配置。'
craftfeature=next(e for e in records if e['id']=='dungeons-artifact-crafting')
craftfeature['description']=craftfeature['description'].replace('通常版8種類','通常版14種類')
for path,data in [(web/'src/data/field-guide.json',records),(web/'src/data/dungeons-guide.json',groups),(contentfile,contents)]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'added':len(records)-before,'total':len(records),'dungeons':sum(e['contentId']=='minecraft-dungeons' for e in records),'groups':{g['id']:len(g['entries']) for g in groups}},ensure_ascii=False))

