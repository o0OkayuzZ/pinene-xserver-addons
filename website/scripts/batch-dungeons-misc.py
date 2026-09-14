"""Build the miscellaneous Dungeons batch from pinned Git objects, Web writes only."""
import json, re, subprocess, sys
from pathlib import Path
from functools import lru_cache
from collections import Counter, defaultdict
web = Path(__file__).resolve().parents[1]
repo = web.parent
revision = '3b66fddebe8006ea5f3656d509bf833d7594a09f'
def git(*args): return subprocess.check_output(['git', *args], cwd=repo)
tree = set(git('ls-tree', '-r', '--name-only', revision).decode().splitlines())
bp = next(p.rsplit('/', 1)[0] for p in tree if p.startswith('behavior_packs/bp_08_') and p.endswith('/manifest.json'))
rp = next(p.rsplit('/', 1)[0] for p in tree if p.startswith('resource_packs/rp_06_') and p.endswith('/manifest.json'))
cached = {}
batch_paths = sorted(p for p in tree if (p.startswith(bp+'/') or p.startswith(rp+'/')) and p.endswith(('.json','.js','.lang','.mcfunction')))
batch = subprocess.run(['git','cat-file','--batch'], input=''.join(revision+':'+p+'\n' for p in batch_paths).encode(), stdout=subprocess.PIPE, check=True, cwd=repo).stdout
offset=0
for p in batch_paths:
    end=batch.index(b'\n',offset); header=batch[offset:end].split(); assert header[1]==b'blob',p
    size=int(header[2]);cached[p]=batch[end+1:end+1+size];offset=end+size+2
@lru_cache(None)
def text(path): return (cached[path] if path in cached else git('show', revision + ':' + path)).decode('utf-8-sig')
@lru_cache(None)
def source(path): return json.loads(text(path))
langpath = rp + '/texts/ja_JP.lang'
lang = dict(line.split('=', 1) for line in text(langpath).splitlines() if '=' in line)
assigned = json.loads(git('show','90cae3be:website/artifacts/dungeons-remaining-audit.json').decode())['unpublishedItemsByCategory']
assigned_ids = set(i for c in ['armor/limited','other','keys','legacy','painting','rune'] for i in assigned[c])
items = {source(p)['minecraft:item']['description']['identifier']: p for p in sorted(tree) if p.startswith(bp+'/items/') and p.endswith('.json')}
recipes = [p for p in sorted(tree) if p.startswith(bp+'/recipes/blocks/') or p in [bp+'/recipes/'+r+'.json' for r in ['enchanted_eye','forge_core','pink_print','target_dummy']]]
if '--inspect' in sys.argv:
    for identifier in sorted(assigned_ids):
        p=items[identifier];d=source(p)['minecraft:item']; c=d['components']
        print(identifier, json.dumps(c, ensure_ascii=False))
    for p in recipes: print(p, text(p))
    sys.exit(0)

atlaspath=rp+'/textures/item_texture.json';atlas=source(atlaspath)['texture_data']
terrainpath=rp+'/textures/terrain_texture.json';terrain=source(terrainpath)['texture_data']
blocks={source(p)['minecraft:block']['description']['identifier']:p for p in sorted(tree) if p.startswith(bp+'/blocks/') and p.endswith('.json')}
records=json.loads((web/'src/data/field-guide.json').read_text(encoding='utf-8'))
existing={e['id']:e for e in records}
result={'entries':[], 'groupEntries':{'crafting':[]},'newGroups':[], 'excluded':[], 'excludedRecipes':[], 'sourceCommit':revision}
groups={}
for ident,title,intro in [
    ('seasonal-armor','季節の防具','大釜・マントのスカル・不気味なゴーディアンの3系列。報酬候補と基本設定を掲載。現在の入手機会や開催時期は未確認です。'),
    ('keys','ボスと試練の鍵','14種類のボス用の鍵と4種類の試練の鍵。解錠対象を確認できたものと、用途が未確認のものを区別しています。'),
    ('runes','ルーンの収集','9種類のルーンを画像で見比べよう。確認できた報酬候補を掲載し、未確認の用途は明記しています。'),
    ('decorations','絵画と飾り','14種類の絵画と小さな像。拠点に置けるコレクションを見比べよう。'),
    ('building','建材と仕掛けのレシピ','砂・丸石から広がる8種類の砂漠レンガ建材と、フォージコア。材料の配置と完成数を確認できます。')]:
    group={'id':ident,'title':title,'intro':intro,'entries':[]};result['newGroups'].append(group);groups[ident]=group['entries']
groups.update(result['groupEntries'])
def clean(value): return re.sub(r'[\ue000-\uf8ff]','',re.sub(r'§.','',value)).strip()
vanilla={'gold_ingot':'金インゴット','cobblestone':'丸石','sand':'砂','diamond':'ダイヤモンド','ender_eye':'エンダーアイ','stone_bricks':'石レンガ','deepslate_bricks':'深層岩レンガ','redstone_block':'レッドストーンブロック','netherite_scrap':'ネザライトの欠片','hay_block':'干草の俵','stick':'棒','leather':'革','iron_ingot':'鉄インゴット','bone':'骨'}
def label(identifier):
    if identifier.removeprefix('minecraft:') in vanilla:return vanilla[identifier.removeprefix('minecraft:')]
    value=next((lang[k] for k in ['item.'+identifier,'item.'+identifier+'.name','tile.'+identifier+'.name','entity.'+identifier+'.name'] if k in lang),None)
    assert value, identifier
    return clean(value)
def slug(identifier):return 'dungeons-'+identifier.split(':')[1].replace('_','-')
def evidence(paths):
    assert all(p in tree for p in paths), paths
    return {'commit':revision,'paths':list(dict.fromkeys(paths))}
def copy_texture(identifier,c,isblock=False):
    if not isblock:
        icon=c['minecraft:icon']; tex=atlas[icon]['textures']; ap=atlaspath
    else:
        mat=c.get('minecraft:material_instances')
        if mat:key=mat.get('*',next(iter(mat.values())))['texture']
        else:key=source(rp+'/blocks.json')[identifier]['textures']
        if isinstance(key,dict):key=key.get('side',next(iter(key.values())))
        tex=terrain[key]['textures'];ap=terrainpath
    if isinstance(tex,list):tex=tex[0]
    if isinstance(tex,dict) and 'variations' in tex:tex=tex['variations'][0]
    if isinstance(tex,dict):tex=tex['path']
    path=rp+'/'+tex+'.png';assert path in tree,path
    name=slug(identifier);target=web/f'public/images/items/{name}.png'; target.write_bytes(git('show',revision+':'+path))
    return {'src':f'/images/items/{name}.png','alt':label(identifier)+'のパック内画像','kind':'pack-texture'},[ap,path,*([rp+'/blocks.json'] if isblock and not c.get('minecraft:material_instances') else [])]
def loot_walk(node,path,seen):
    found={}
    if isinstance(node,list):
        for n in node:found.update(loot_walk(n,path,seen))
    elif isinstance(node,dict):
        if node.get('weight',1)<=0:return found
        if node.get('type')=='item':found[node['name']]=[path]
        if node.get('type')=='loot_table':
            child=bp+'/'+node['name']
            if child in tree and child not in seen:
                for identifier,chain in loot_walk(source(child),child,seen|{child}).items():found[identifier]=[path,*chain]
        for key in ['pools','entries','children']:found.update(loot_walk(node.get(key,[]),path,seen))
    return found
rewardchains={}
for p in sorted(tree):
    if p.startswith(bp+'/loot_tables/chests/diamond_chest/') and p.count('/')==bp.count('/')+4 and p.endswith('.json'):
        for identifier,chain in loot_walk(source(p),p,{p}).items():rewardchains.setdefault(identifier,chain)
lootpaths=defaultdict(list)
for p in sorted(tree):
    if p.startswith(bp+'/loot_tables/') and p.endswith('.json'):
        for identifier in assigned_ids:
            if '"'+identifier+'"' in text(p) and identifier in loot_walk(source(p),p,{p}):lootpaths[identifier].append(p)
def item(identifier,group,summary,description,usage,obtaining=None,details=None,paths=None,isblock=False):
    path=(blocks if isblock else items)[identifier];raw=source(path)['minecraft:block' if isblock else 'minecraft:item'];c=raw['components']
    image,imagesources=copy_texture(identifier,c,isblock)
    name=label(identifier)
    if '/rune/' in path:name+='（'+identifier[-1].upper()+'）'
    extra=list(details or [])
    if 'minecraft:wearable' in c:
        w=c['minecraft:wearable'];part={'slot.armor.head':'頭','slot.armor.chest':'胴','slot.armor.legs':'脚','slot.armor.feet':'足'}[w['slot']]
        extra.append(f"装備部位：{part}。防御値の設定：{w['protection']}。")
    if 'minecraft:durability' in c:extra.append(f"耐久値の設定：{c['minecraft:durability']['max_durability']}。")
    if 'minecraft:repairable' in c:extra.append('修理材料の設定：'+'、'.join(label(i) for rule in c['minecraft:repairable']['repair_items'] for i in rule['items'])+'。修復操作はゲーム内で未検証です。')
    paths=[path,langpath,*imagesources,*(paths or [])]
    if identifier in rewardchains:
        paths+=rewardchains[identifier]
        if obtaining is None:obtaining='ボスチェスト報酬の抽選候補に含まれます。確定入手や全ボス共通の報酬ではありません。'
    entry={'id':slug(identifier),'name':name,'kind':'item','contentId':'minecraft-dungeons','summary':summary,'description':description,'usage':usage,'obtaining':obtaining or '個別の入手経路は未確認です。名前から入手場所やドロップ率を推測していません。','details':extra,'image':image,'recipe':None,'visibility':'public','evidence':evidence(paths)}
    assert entry['id'] not in {e['id'] for e in result['entries']}
    result['entries'].append(entry);groups[group].append(entry['id']);return entry

for identifier in assigned['legacy']:
    c=source(items[identifier])['minecraft:item']['components']; replacement=c['minecraft:block_placer']['block'];assert replacement in blocks
    result['excluded'].append({'identifier':identifier,'path':items[identifier],'reason':'legacy 内の旧アイテム定義。現行の設置ブロック '+replacement+' を掲載し、同じ設置対象の旧アイテムを重複掲載しない。'})
for identifier in assigned['armor/limited']:
    assert identifier in rewardchains,identifier
    item(identifier,'seasonal-armor','季節装備として登録された防具。部位・防御値・耐久値を掲載。','普段の防具とは別枠で見比べられる季節の装備です。頭・胴・脚・足ごとの見た目と基本設定を確認できます。','対応する防具スロットに装備します。シリーズ固有の効果は、名称やタグだけから推測していません。',obtaining='不気味なモンスターのボスチェストに報酬候補として登録されています。現在の入手機会・配布期間・イベント開催は未確認です。',details=['季節装備のタグがあります。通常の防具レシピや、いつでも入手できる装備としては案内していません。'])
chestpath=bp+'/entities/utility/chest/diamond/_diamond_chest.json'
keytargets={}
for groupname,groupdata in source(chestpath)['minecraft:entity']['component_groups'].items():
    for interaction in groupdata.get('minecraft:interact',{}).get('interactions',[]):
        checks=interaction['on_interact']['filters']['all_of'];keys=[x['value'] for x in checks if x['test']=='has_equipment']
        assert len(keys)==1 and interaction['use_item'] is True
        keytargets[keys[0]]=groupname.removeprefix('dungeons:').removesuffix('_chest')
bosstitle={'redstone_monstrosity':'レッドストーンの怪物','nameless_one':'名もなき者','mooshroom_monstrosity':'ムーシュルームの怪物','obsidian_monstrosity':'黒曜石の怪物','arch_illager':'邪悪な村人の王','wretched_wraith':'哀れなレイス','corrupted_cauldron':'汚染された大釜','jungle_abomination':'ジャングルの魔物','tempest_golem':'テンペストゴーレム','ancient_guardian':'古代のガーディアン','boss_wildfire':'ワイルドファイア','endersent':'エンダーセント','vengeful_heart_of_ender':'復讐に燃えるエンダーの心臓'}
for identifier in assigned['keys']:
    istrial=identifier.startswith('dungeons:trial_key_')
    if istrial:
        paths=lootpaths[identifier]; assert paths
        item(identifier,'keys','試練アリーナの報酬に登録された鍵。','試練の鍵は石・苔・方解石・虚空の4種類。画像と名前を手がかりに、持っている鍵を見分けられます。','具体的な解錠対象と使用操作は未確認です。ボスチェストの鍵と共通に使えるとは案内していません。',obtaining='試練アリーナ用の報酬テーブルに登録されています。現地での報酬獲得や解錠の動作は未検証です。',paths=paths)
    else:
        target=bosstitle[keytargets[identifier]]
        details=['解錠時に鍵を消費する設定です。すべての宝箱に共通する鍵ではありません。']
        if identifier=='dungeons:skeleton_key':details.append('レッドストーンの怪物用チェストで使うと、通常の鍵とは異なる季節装備系の報酬が選ばれる設定です。現在の配布機会は未確認です。')
        item(identifier,'keys',target+'用のボスチェストを開ける鍵。','ボスを倒した後の報酬を開けるための鍵です。チェストごとに必要な種類が異なるので、名前と画像を確認して準備しましょう。',target+'用のボスチェストを、鍵を手に持って操作します。実際の解錠はゲーム内で未検証です。',obtaining='敵用のドロップテーブルに登録されています。現地の出現場所・確定ドロップは未確認です。' if any('/entities/' in p for p in lootpaths[identifier]) else None,details=details,paths=[chestpath,*lootpaths[identifier]])
for identifier in assigned['rune']:
    rune=identifier[-1].upper()
    item(identifier,'runes',rune+'型のルーン。絵柄と確認できた入手情報を掲載。','同じ名前で登録された9種類を、図鑑では識別文字付きで紹介しています。画像を見比べて、手元のルーンを確認できます。','使用先・組み合わせ・解放される能力は未確認です。集めるだけで能力が増えるとは案内していません。',details=['括弧内の '+rune+' は識別用の表記です。アイテム定義と画像の対応に基づきます。'])
for identifier in assigned['painting']:
    blockpath=blocks[identifier];assert source(blockpath)['minecraft:block']['components']['minecraft:placement_filter']['conditions'][0]['allowed_faces']==['side']
    item(identifier,'decorations','壁の側面に飾る、コレクション用の絵画。','拠点の壁に飾って楽しむ絵画です。14種類の絵柄があり、部屋の雰囲気に合わせて見比べられます。','ブロックの側面に設置する設定です。設置後の見え方や回収はゲーム内で未検証です。',paths=[blockpath],details=['掲載画像はパック内のアイテム用画像です。設置後のスクリーンショットではありません。'])

item('dungeons:enchanted_explorer_map','crafting','使用して探索地図を受け取るための地図アイテム。','次の探索先を探す手がかりになる地図です。使用すると探索地図を出す処理が呼ばれ、クリエイティブ以外では元のアイテムを消費します。','手に持って使用します。地図の目的地や現地までの到達はゲーム内で未検証です。',obtaining='行商人の取引候補に登録されています。毎回の販売や価格は保証していません。',paths=[bp+'/scripts/components/other/endersentMap.js',bp+'/scripts/components/other.js',bp+'/functions/loot/endersentMap.mcfunction',bp+'/trading/economy_trades/wandering_trader_trades.json'])
item('dungeons:bottle_of_souls','crafting','飲むと、100未満のソウルゲージを100にするボトル。','ソウルを使うアーティファクトの準備に使う消耗品です。ゲージが100未満なら100にそろえる処理で、現在値に100を加算するものではありません。','手に持って飲みます。100以上ある場合はゲージを増やさない処理です。',paths=[bp+'/scripts/components/other/soulBottle.js',bp+'/scripts/components/other.js'],details=['実際の消費・ゲージ表示はゲーム内で未検証です。'])
item('dungeons:enchanted_eye_of_ender','crafting','ヴォイドのポータルフレームに使う特別なエンダーアイ。','対応するフレームに使うと、目をはめた状態に変えるアイテムです。元のアイテムを使って2個に増やすレシピも掲載しています。','このアイテムを手に持ち、対応するヴォイドのポータルフレームを操作します。クリエイティブ以外では消費する設定です。',obtaining='最初の1個の入手経路は未確認です。掲載レシピにも、材料として同じアイテムが1個必要です。',paths=[bp+'/scripts/components/blocks/voidPortal.js',bp+'/recipes/enchanted_eye.json'],details=['ポータルの完成条件や移動先での動作は未検証です。'])
item('dungeons:pink_print','crafting','特別なエンダーアイの製作と、設計図の増産に使う素材。','既に持っている桃色の設計図と青色の設計図から、桃色の設計図2枚を得るレシピがあります。最初の1枚は別途必要です。','特別なエンダーアイや桃色の設計図のレシピで、指定された配置・材料として使います。',paths=[bp+'/recipes/pink_print.json',bp+'/recipes/enchanted_eye.json'])
item('dungeons:redstone_ministrosity_statue','decorations','拠点に設置できる、小さなレッドストーンの像。','小さな怪物の姿を飾れる設置アイテムです。武器や仲間を召喚するアーティファクトとは別の、拠点装飾として紹介しています。','手に持って、対応する像のブロックを設置します。設置後の見え方はゲーム内で未検証です。',paths=[blocks['dungeons:ministrosity_statue_block']])
item('dungeons:target_dummy','crafting','武器のダメージを確かめるための訓練用ダミー。','設置して攻撃すると、受けたダメージを名前欄に表示する処理があります。装備を使い比べるための目印として利用できます。','手に持って設置し、武器で攻撃します。表示する値はその一撃の被ダメージで、長時間のDPS計測ではありません。',obtaining='干草の俵・棒・革を使って作業台で製作するレシピがあります。実際の製作は未検証です。',paths=[bp+'/scripts/misc/entityBehaviour/targetDummy.js',bp+'/recipes/target_dummy.json'])
for path in recipes:
    raw=source(path);key=next(k for k in raw if k.startswith('minecraft:recipe_'));r=raw[key];identifier=r['result']['item']
    if identifier not in items:
        assert identifier in blocks
        if identifier=='dungeons:redstone_core_block':
            item(identifier,'building','起動すると周囲へ爆発の効果を出す仕掛けブロック。','準備状態で操作すると起動し、周囲へのダメージ処理が発生するフォージコアです。再充電して準備状態へ戻る処理もあります。','周囲にプレイヤーや建築物がない場所で扱います。攻撃対象だけでなくプレイヤーも効果の対象になり、設定によっては周囲のブロックを壊します。',obtaining='作業台で製作するレシピを掲載しています。実際の起動・爆発範囲・再充電時間は未検証です。',paths=[path,bp+'/scripts/components/blocks/redstoneCore.js'],isblock=True)
        else:
            item(identifier,'building','砂漠レンガ系列の建築ブロック。製作配置と完成数を掲載。','砂と丸石から作れる砂漠レンガを中心に、柱・土台・タイル・ハーフブロックなどへ加工する建材です。掲載画像はブロック表面のテクスチャです。','建築の壁・柱・床などに、形に合わせて設置します。設置後の形状や見え方はゲーム内で未検証です。',obtaining='作業台で製作するレシピを掲載しています。材料と完成数は下のレシピで確認できます。',paths=[path],isblock=True)
    target=next((e for e in result['entries'] if e['id']==slug(identifier)),existing.get(slug(identifier)));assert target and target['kind']=='item'
    shaped=key=='minecraft:recipe_shaped'; assert r['tags']==['crafting_table']
    if shaped:
        keys={k:label(v['item']) for k,v in r['key'].items()};assert all(set(v)=={'item'} for v in r['key'].values())
        grid=[[keys.get(c,'') for c in row] for row in r['pattern']];counts=Counter(v for row in grid for v in row if v)
    else:
        grid=[];counts=Counter()
        for ingredient in r['ingredients']:counts[label(ingredient['item'])]+=ingredient.get('count',1)
    needs_original=identifier in [v['item'] for v in r.get('key',{}).values()] or identifier in [v['item'] for v in r.get('ingredients',[])]
    name=target['name']+('を増やすレシピ' if needs_original else 'のレシピ')
    details=['元になる同じアイテムが1個必要です。初めての入手に使うレシピではありません。'] if needs_original else []
    e={'id':slug(identifier)+'-recipe','name':name,'kind':'recipe','contentId':'minecraft-dungeons','summary':target['name']+('を、同じアイテムを材料に2個へ増やす配置。' if needs_original else 'を作る材料と配置。'),'description':'必要な材料・配置・完成数を、現在のレシピ定義に合わせて掲載しています。','usage':'作業台で、'+('下の配置どおりに材料を並べます。' if shaped else '材料を配置自由に組み合わせます。'),'obtaining':'レシピ定義を照合済みです。実際の製作とレシピ解放表示はゲーム内で未検証です。','details':details,'image':None,'recipe':{'shaped':shaped,'grid':grid,'ingredients':[{'name':k,'count':v} for k,v in counts.items()],'resultId':target['id'],'count':r['result'].get('count',1)},'visibility':'public','evidence':evidence([path,langpath,target['evidence']['paths'][0]])}
    result['entries'].append(e);groups['building' if '/blocks/' in path or identifier=='dungeons:redstone_core_block' else 'crafting'].append(e['id'])
assert len(assigned_ids)==72
covered={source(e['evidence']['paths'][0])['minecraft:item']['description']['identifier'] for e in result['entries'] if e['kind']=='item' and '/items/' in e['evidence']['paths'][0]}
assert covered|{e['identifier'] for e in result['excluded']}==assigned_ids
assert len(covered)==59 and len(result['excluded'])==13
assert len(recipes)==12 and sum(e['kind']=='recipe' for e in result['entries'])==12
assert len(result['entries'])==80
assert len({e['id'] for e in result['entries']})==80
out=web/'artifacts/batch-misc.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'entries':len(result['entries']),'sourceItems':len(covered),'extraBlockItems':9,'recipes':12,'excludedLegacy':13,'groups':{k:len(v) for k,v in groups.items()}},ensure_ascii=False))
