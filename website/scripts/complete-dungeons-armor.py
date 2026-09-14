"""Remaining standard armor batch. Only website files are written."""
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

assert len(groupmap['armor']['entries'])==112,'This batch requires the preceding armor catalogue'
added_families=[]
for category in ['common','unique']:
    for folder in sorted((bp/f'items/armor/{category}').iterdir()):
        files=sorted(folder.glob('*.json'));assert len(files)==4,folder
        missing=[p for p in files if 'dungeons-'+read(p)['minecraft:item']['description']['identifier'].split(':')[1].replace('_','-') not in ids]
        if not missing:continue
        assert len(missing)==4,folder
        added_families.append(folder.relative_to(bp/'items').as_posix())
        for p in missing:
            c=read(p)['minecraft:item']['components'];w=c['minecraft:wearable']
            slot={'slot.armor.head':'頭','slot.armor.chest':'胴','slot.armor.legs':'脚','slot.armor.feet':'足'}[w['slot']]
            item(p,'armor',f"{slot}に装備する防具。防御値の設定は{w['protection']}。",
                 '同じ系列の頭・胴・脚・足をそろえるための防具です。個別の画像、部位、防御値、耐久値、修理材料を確認できます。',
                 '対応する防具スロットに装備します。シリーズ固有の効果や必要な組み合わせは、名称だけから推測していません。')
assert len(records)-before==84 and len(added_families)==21
groupmap['armor']['intro']='限定品を除く49系列・196部位を掲載。頭・胴・脚・足の見た目と基本設定を比較できます。'
contentfile=web/'src/data/content-registry.json';contents=read(contentfile);content=next(c for c in contents['contents'] if c['id']=='minecraft-dungeons')
content['highlights'][1]='限定品を除く49系列・196部位の防具を画像付きで掲載。'
for path,data in [(web/'src/data/field-guide.json',records),(web/'src/data/dungeons-guide.json',groups),(contentfile,contents)]:path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'added':len(records)-before,'total':len(records),'dungeons':sum(e['contentId']=='minecraft-dungeons' for e in records),'lastArmor':groupmap['armor']['entries'][-1]},ensure_ascii=False))

