"""Publish reviewed September 12-13 gameplay changes without resetting existing guides."""
from pathlib import Path
import json,shutil,subprocess,collections
web=Path(__file__).resolve().parents[1];root=web.parent
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
bp='behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/'
rp='resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10/'
core='behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/'
bsl='behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/'
castle='behavior_packs/bp_16_3efecae8-a036-4e14-94d3-876e29fe0ae9/'
def read(name):return json.loads((web/'src/data'/name).read_text(encoding='utf-8'))
def write(name,data):(web/'src/data'/name).write_bytes((json.dumps(data,ensure_ascii=False,indent=2)+'\n').encode())
contents=read('content-registry.json');packs=read('pack-registry.json');entries=read('field-guide.json')
byid={e['id']:e for e in entries};owners={c['id']:c for c in contents['contents']}
def evidence(paths):
 for p in paths:assert (root/p).is_file(),p
 return {'commit':revision,'paths':paths}
def entry(id,name,kind,owner,summary,description,usage,obtaining,details,paths,image=None,recipe=None):
 e=dict(id=id,name=name,kind=kind,contentId=owner,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=recipe,visibility='public',evidence=evidence(paths))
 if id in byid:byid[id].update(e)
 else:entries.append(e);byid[id]=e
for folder in [bp,rp,bsl]:
 m=json.loads((root/folder/'manifest.json').read_text(encoding='utf-8'))['header'];kind='behavior' if folder.startswith('behavior') else 'resource'
 p=next((p for p in packs['packs'] if p['uuid']==m['uuid']),None)
 if p is None:p={'uuid':m['uuid'],'name':m['name'],'kind':kind,'visibility':'public'};packs['packs'].append(p)
 p.update(version='.'.join(map(str,m['version'])),registered=True)
for p in packs['packs']:
 for f in (root/(p['kind']+'_packs')).glob('*/manifest.json'):
  h=json.loads(f.read_text(encoding='utf-8-sig'))['header']
  if h['uuid']==p['uuid']:p['version']='.'.join(map(str,h['version']))
packs['source_commit']=revision
owners['zombie-gear'].update(summary='腐敗を力に変え、幹細胞で浄化する4部位の防具。',description='4部位をそろえると最大HP80。致死ダメージからHP40で蘇生するたびに腐敗が進み、近接攻撃が強くなる一方、持てる残機は減ります。幹細胞を使って腐敗を浄化し、次の戦いに備える装備です。',category=['combat','craft'],visibility='public',implementation='implemented',deployment='repo-only',verification=[{'kind':'code','result':'confirmed','commit':revision},{'kind':'registration','result':'confirmed','commit':revision},{'kind':'gameplay','result':'unknown'}],image={'src':'/images/zombie-gear.png','alt':'Zombie Gear FINALの基準版をMinecraftの装備画面で確認した画像。','kind':'actual-screenshot'},highlights=['混在セットも4部位の最低腐敗度で能力を判定。装備交換だけでは腐敗を変換しません。','近接攻撃はC0からC4で1.0・1.1・1.3・1.7・2.5倍。感染の被ダメージ増加は最大30%。','残機は最大4から0。蘇生・浄化成功時に4部位の腐敗度が統一されます。','夜間は満腹度8以上で毎秒1HP。腐った肉は栄養回復・HP+8・防具10%修理に利用できます。'],guide='防具4部位を装備し、幹細胞を持って8秒しゃがむと浄化と残機補充ができます。持ち替え・しゃがみ解除・装備変更・戦闘で中断します。C4でも夜間回復や腐った肉の効果は使えますが、残機は持てません。',children=[],related=['infinite-castle','minecraft-dungeons'],packBindings=[{'uuid':'7c8ac348-47ad-4f71-8503-dc40a6f813f1','roles':['item-definition','runtime-script','recipe']},{'uuid':'4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10','roles':['texture','model']}],evidence=evidence([bp+'scripts/main.js',bp+'scripts/rules.js',bp+'scripts/combat.js']))
shutil.copyfile(root/'docs/zombie_gear_final/engine-enchanted-inventory.png',web/'public/images/zombie-gear.png')
owners['better-structure-loot'].update(summary='構造物と無限城の宝箱に、探索の報酬を。',description='構造物の宝箱に食料・素材・収集品などの報酬を設定する仕組みです。無限城では宝箱の27枠を個別に抽選し、最低1枠の基本報酬と空欄を含む追加報酬を組み合わせます。',category=['exploration','collection'],visibility='public',implementation='implemented',deployment='repo-only',verification=[{'kind':'code','result':'confirmed','commit':revision},{'kind':'registration','result':'confirmed','commit':revision},{'kind':'gameplay','result':'unknown'}],image={'src':'/images/infinite-castle.svg','alt':'宝箱を探す無限城のイメージ。実際のゲーム画面ではありません。','kind':'concept'},highlights=['無限城の27枠から1枠を選び、基本報酬を保証。','残り26枠は空欄も含めて個別に抽選。','衛兵・怨霊・呪術・混成・重装・Elite・宝物庫の7種類の報酬設定。','配布済みの宝箱は再抽選や補充を行いません。'],guide='新しく報酬が生成される宝箱が対象です。無限城では戦闘を終え、鍵持ちを倒して宝箱の封印を解除してください。空欄があっても抽選結果として確定していることがあります。',children=[],related=['infinite-castle'],packBindings=[{'uuid':'423276b9-02f5-4082-911a-c631a2d83d12','roles':['loot']}],evidence=evidence([bsl+'manifest.json',bsl+'loot_tables/chests/infinite_castle/slots/guard.json','docs/infinite_castle/slot-rewards-20260912.md']))
for c in range(5):
 for part,jp,protection in [('helmet','ヘルメット',2),('chestplate','チェストプレート',4),('leggings','レギンス',4),('boots','ブーツ',1)]:
  suffix=f'_c{c}' if c else '';item=f'zombie_{part}{suffix}';id=f'zombie-{part}-c{c}'
  components=json.loads((root/bp/'items'/f'{item}.item.json').read_text())['minecraft:item']['components']
  image=f'/images/items/{id}.png';shutil.copyfile(root/rp/'textures/merged_equipment'/f'{item}.png',web/('public'+image))
  entry(id,f'ゾンビ{jp} C{c}','item','zombie-gear',f'腐敗C{c}の{jp}。防御値{protection}。','4部位をそろえて使うZombie Gearの防具です。部位ごとの腐敗度が違ってもフルセットとして扱い、全体の能力は最も低い腐敗度に従います。','対応する防具スロットへ装備します。','C0は幹細胞から作業台で作成。蘇生・浄化によって腐敗度が変化します。',[f'防御値：{protection}。全4部位の合計は11。',f'耐久値：{components["minecraft:durability"]["max_durability"]}。',f'全体の実効腐敗度がC{c}の場合、直接近接倍率は{[1,1.1,1.3,1.7,2.5][c]}倍、ノックバック耐性は{[40,56,72,88,100][c]}%、最大残機は{4-c}。','装備の付け替えだけではアイテムの腐敗度は書き換わりません。'],[bp+f'items/{item}.item.json',bp+'scripts/main.js',bp+'scripts/rules.js'],{'src':image,'alt':f'ゾンビ{jp} C{c}のアイコン','kind':'pack-texture'})
entry('zombie-stem-cell','ゾンビ幹細胞','item','zombie-gear','防具の作成と、8秒チャージによる浄化に使う素材。','腐敗を1段階浄化し、残機を1つ補充するための素材です。C0では残機の補充に使えます。','4部位を装備し、手に持って8秒しゃがみます。','作業台で不死のトーテム4個と腐った肉5個から1個作成します。',['浄化できる腐敗度があれば、現在の残機上限でも使用できます。','成功時に1個消費。C4/残機0からC3/残機1へ戻せます。','C0で残機4の場合は使用しません。'],[core+'recipes/zonbikansaibou.recipe.json',bp+'scripts/main.js'])
for part,jp in [('helmet','ヘルメット'),('chestplate','チェストプレート'),('leggings','レギンス'),('boots','ブーツ'),('stem-cell','幹細胞')]:
 path=core+'recipes/zonbikansaibou.recipe.json' if part=='stem-cell' else bp+f'recipes/zombie_{part}.recipe.json'
 recipe=json.loads((root/path).read_text(encoding='utf-8'))['minecraft:recipe_shaped']
 names={'pinematerials:zonbikansaibou':'ゾンビ幹細胞','minecraft:totem_of_undying':'不死のトーテム','minecraft:rotten_flesh':'腐った肉'}
 grid=[[names[recipe['key'][char]['item']] if char!=' ' else '' for char in row] for row in recipe['pattern']]
 counts=collections.Counter(n for row in grid for n in row if n)
 result='zombie-stem-cell' if part=='stem-cell' else f'zombie-{part}-c0'
 entry('craft-zombie-'+part,'ゾンビ'+jp+'の作り方','recipe','zombie-gear','作業台で素材を並べて作成。','材料と配置はゲーム内のレシピに対応しています。','作業台で下記の配置に材料を置きます。','記載した素材をそろえて作成します。',[],[path],recipe={'resultId':result,'count':1,'shaped':True,'grid':grid,'ingredients':[{'name':n,'count':v} for n,v in counts.items()]})
entry('zombie-recovery','蘇生と腐敗・浄化','feature','zombie-gear','蘇生で腐敗が進み、幹細胞で取り戻す。','蘇生はHP40で復帰し、4部位を実効腐敗度+1へ統一します。幹細胞による浄化は実効腐敗度−1へ統一します。','残機を補充して戦い、腐敗が進んだら安全な場所で幹細胞をチャージします。','Zombie Gearを4部位装備すると利用できます。',['蘇生：C0/4 → C1/3 → C2/2 → C3/1 → C4/0。','浄化：C4/0 → C3/1 → C2/2 → C1/3 → C0/4。','C4/C4/C4/C1で蘇生すると全4部位C2へ。','蘇生時は炎上解除、Speed II 3秒、ノックバック完全耐性3秒。','名前・Lore・耐久・エンチャントなどを保持して変換します。'],[bp+'scripts/main.js',bp+'scripts/knockback.js'])
entry('zombie-infection-diet','近接感染と食事','feature','zombie-gear','近接で感染を与え、腐った肉で回復。','感染は段階ごとに攻撃力が10%ずつ下がり、受けるダメージが10%ずつ増えます。感染IIIは攻撃0.70倍・被ダメージ1.30倍。牛乳で解除できます。','剣・素手・斧などの直接近接で感染させます。腐った肉を回復に利用してください。','Zombie Gearを4部位装備すると利用できます。',['矢・クロスボウ・投擲トライデント・DOT・爆発・魔法には腐敗の攻撃倍率と感染付与は適用しません。','腐った肉は通常の栄養回復、HP+8、防具の耐久10%修理。','通常食は食べられますが満腹度と隠し満腹度は増えません。食料の固有效果は利用できます。','即時回復・再生能力は禁止、衝撃吸収は利用可能。','夜間は満腹度8以上で毎秒1HP回復。C4と戦闘中も有効。','昼間のオーバーワールド直射日光は炎上と防具耐久のペナルティ。'],[bp+'scripts/main.js',bp+'scripts/rules.js',bp+'scripts/combat.js',bp+'scripts/diet.js'])
entry('bsl-castle-slot-rewards','無限城の宝箱抽選','feature','better-structure-loot','最低1枠の報酬と、26枠の追加抽選。','27枠からランダムに1枠を選び基本報酬を保証し、残り26枠は空欄も含めて個別抽選します。同じアイテムが別の枠に出ることもあります。','無限城の戦闘を終え、宝箱の封印を解除します。','新しく生成される無限城報酬に適用します。',['7種類は報酬区分の数で、アイテムの種類数ではありません。','配布済みのチェストは再抽選・再配置・再補充しません。','処理の再開時にも、確定済みの枠を再抽選しない仕組みです。'],[bsl+'loot_tables/chests/infinite_castle/slots/guard.json','docs/infinite_castle/slot-rewards-20260912.md'])
reconstruction=byid['castle-reconstruction'];reconstruction['description']='城本体は5〜15分、背景の飾りは15秒〜2分の範囲で、中央の待ち時間が出やすい抽選をします。背景には遠くに響く琴、城本体には近くで明瞭に鳴る琴を使います。'
reconstruction['details']=['本体は10分前後、飾りは67.5秒前後が出やすく、毎回固定のタイマーではありません。','昼夜を固定しても進む経過tick時計を使い、抽選済みの期限は再起動後も継続します。','在室プレイヤー・戦闘・出口を保護するため、実際の開始が遅れる場合があります。無人では再構成しません。','城内の夕暮れの霧と、背景・本体で異なる琴の演出を組み合わせています。'];reconstruction['evidence']=evidence([castle+'scripts/infinite_castle/phase1Config.js',castle+'scripts/infinite_castle/infiniteCastleManager.js','docs/infinite_castle/bell-intervals-20260912.md'])
entry('castle-temporary-death','城内で倒れたとき（仮設定）','feature','infinite-castle','持ち込み品を保持し、城内の入手品を失って帰還。','現在の仮設定では、城への入場時に持っていた品を保護します。城内で死亡した後は城内で得た持ち物を失い、保存された帰還地点へ戻ります。正式な城ルールが決まるまでの設定です。','城へ入る前に持ち物を確認してください。城内では墓の生成と鍵による墓への移動を利用しません。','無限城への入場から帰還までに適用します。',['持ち込み品には入場中だけ目印が付き、正常な帰還時に元の説明文と死亡時保持設定へ戻ります。','Zombie Gearの腐敗変換でも持ち込み品の目印を保持します。','導入前から城内にいたプレイヤーは由来が分からないため、最初の帰還では持ち物を削除しません。','最新の仮設定と他の復活・墓機能を組み合わせた操作は、引き続き実機確認が必要です。'],[castle+'scripts/infinite_castle/castleTemporaryDeathPolicy.js',castle+'scripts/infinite_castle/entranceTransition.js','behavior_packs/bp_06_8aa58918-0a45-44ac-8d7a-dc5c1be8ef8a/scripts/main.js'])
guides=read('exploration-guides.json');cg=next(g for g in guides if g['contentId']=='infinite-castle')
if not any(g['id']=='temporary-death' for g in cg['groups']):cg['groups'].append({'id':'temporary-death','title':'城内で倒れたとき（仮設定）','entries':['castle-temporary-death']})
write('exploration-guides.json',guides)
grave=owners['grave'];note='無限城内では仮の持ち込み品保護ルールを使うため、墓の生成と鍵による墓への移動は無効です。'
if note not in grave['guide']:grave['guide']+=' '+note
grave['evidence']=evidence(['behavior_packs/bp_06_8aa58918-0a45-44ac-8d7a-dc5c1be8ef8a/scripts/main.js','behavior_packs/bp_06_8aa58918-0a45-44ac-8d7a-dc5c1be8ef8a/scripts/functions.js'])
contents['source_commit']=revision
write('content-registry.json',contents);write('pack-registry.json',packs);write('field-guide.json',entries)
write('updates.json',[{'id':'release-20260913','title':'Zombie Gear FINALと9月12・13日の更新','body':'Zombie Gearの防具20種類・幹細胞・蘇生と浄化、BSLの宝箱抽選を公開しました。無限城の再構成間隔を最新仕様へ更新し、Dungeonsの装備・レシピ、Mycologyの鑑定演出の案内と合わせて確認できます。','date':'2026-09-13','visibility':'public'}])
print('Updated Zombie Gear, BSL, castle timers and pack versions; entries:',len(entries))
