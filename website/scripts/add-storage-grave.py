"""Reviewed storage/grave guide batch; Minecraft files remain read-only."""
import json,re,shutil
from pathlib import Path
web=Path(__file__).resolve().parents[1];repo=web.parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def pack(kind,n):return next((repo/f'{kind}_packs').glob(f'{"bp" if kind=="behavior" else "rp"}_{n:02d}_*'))
bp,rp,gb,gr=pack('behavior',15),pack('resource',2),pack('behavior',6),pack('resource',3)
sha='aea85120954a8b74033b86253c17a04b691dab21';file=web/'src/data/field-guide.json';records=read(file);new=[]
def proof(paths):
    for p in paths:assert p.is_file(),p
    return {'commit':sha,'paths':list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
def add(slug,name,kind,owner,summary,description,usage,obtaining,details,paths,image=None,recipe=None):
    assert not any(e['id']==slug for e in records+new),slug
    new.append(dict(id=slug,name=name,kind=kind,contentId=owner,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=recipe,visibility='public',evidence=proof(paths)))
runtime=[bp/'manifest.json',bp/'scripts/main.js',bp/'scripts/meitetsu_chest.js',bp/'blocks/meitetsu_chest.json',bp/'entities/meitetsu_chest_container.json']
assert 'import "./meitetsu_chest.js";' in runtime[1].read_text(encoding='utf-8')
assert read(runtime[-1])['minecraft:entity']['components']['minecraft:inventory']['inventory_size']==27
add('meitetsu-chest','冥鉄の箱','item','meitetsu-chest','合言葉を設定して使う、27枠の収納。','収納用のブロックと専用インベントリを組み合わせた箱です。所有者の登録、合言葉の設定、回収メニューを持つ処理を確認しています。','設置後、最初にしゃがんで操作した人を箱の管理者として登録する構成です。続いて合言葉を設定し、箱の中央やふたを操作します。','チェスト1個・ネザライトインゴット2個・金インゴット1個の作業台レシピがあります。配置の違いは関連レシピを参照してください。',['収納枠の設定：27。','収納の永続化、アイテム収支、第三者からの保護はゲーム内で未検証です。'],runtime)
recipes=sorted((bp/'recipes/meitetsu_chest').glob('*.json'));assert len(recipes)==6
positions={'tl':'左上','tr':'右上','ml':'左中央','mr':'右中央','bl':'左下','br':'右下'}
names={'minecraft:chest':'チェスト','minecraft:netherite_ingot':'ネザライトインゴット','minecraft:gold_ingot':'金インゴット'}
for path in recipes:
    r=read(path)['minecraft:recipe_shaped'];assert r['result']['item']=='pinene:meitetsu_chest' and r['tags']==['crafting_table']
    grid=[[names[r['key'][s]['item']] if s!=' ' else '' for s in row] for row in r['pattern']];materials=[s for row in grid for s in row if s]
    counts={s:materials.count(s) for s in dict.fromkeys(materials)};assert counts=={'金インゴット':1,'ネザライトインゴット':2,'チェスト':1}
    pos=path.stem.rsplit('_',1)[1]
    add('craft-meitetsu-chest-'+pos,'冥鉄の箱のレシピ（金：'+positions[pos]+'）','recipe','meitetsu-chest','金インゴットを'+positions[pos]+'に置く配置。','同じ箱を作る6つの配置のうちの1つです。完成品の性能が変わるレシピではありません。','下の表に合わせて材料を作業台に並べます。','素材の入手とクラフトの実動作は未確認です。',['完成数の指定が省略されているため、既定の1個として表示しています。'],[path],recipe={'shaped':True,'grid':grid,'ingredients':[{'name':n,'count':c} for n,c in counts.items()],'resultId':'meitetsu-chest','count':1})
add('meitetsu-passcode','箱の合言葉を設定する','feature','meitetsu-chest','箱ごとに合言葉を決め、利用時に入力。','管理者が合言葉を2回入力して設定し、ほかのプレイヤーは一致する合言葉を入力してアクセスする処理です。','合言葉は4〜32文字です。管理者がしゃがんで操作すると管理メニューを開く構成です。','管理者が登録済みの冥鉄の箱が必要です。',['合言葉を変更すると、以前のアクセス許可を取り消す処理があります。','セキュリティ強度やゲーム内での保護性能を保証するものではありません。'],runtime)
add('meitetsu-recovery','箱と中身を回収する','feature','meitetsu-chest','管理メニューから箱と収納物を回収。','管理者向けに、採掘モードと回収操作を用意した処理です。回収操作には確認画面があります。','管理者がしゃがんで操作し、回収メニューを選ぶ構成です。','箱の管理者として登録されている必要があります。',['回収確認には箱と中身をその場にドロップし、管理者と合言葉の登録を解除する旨が表示されます。','アイテムの欠損・重複がないことは実ゲームで未確認です。'],runtime)
gravepaths=[gb/'manifest.json',gb/'scripts/main.js',gb/'scripts/functions.js']
for stem,slug,name,summary,usage,obtaining in [
('llave','grave-key','墓の鍵（移動対応）','墓を開け、記録された場所へ戻るための鍵。','手に持って使用すると、設定に応じて鍵の座標情報などから移動先を求める処理があります。墓を開ける操作にも使用します。','死亡後のリスポーン処理から、設定に応じて付与する構成です。'),
('llave2','grave-key-ordinary','墓の鍵（通常）','墓を開ける操作に対応する通常の鍵。','鍵を手に持って墓を攻撃する開錠処理の対象です。このIDは、使用時の座標移動処理の対象には入っていません。','鍵の種類をランダムにする設定で、付与候補に含まれます。'),
('visual_config','grave-visual-config','墓の見た目設定キー','墓のモデルと名前の色を選ぶ設定用アイテム。','手に持って使用すると、モデルと名前の色を選ぶメニューを開く処理です。','初期化済みの印がないプレイヤーへ、スポーン時に付与する処理があります。')]:
    p=gb/f'items/{stem}.json';c=read(p)['minecraft:item']['components'];table=gr/'textures/item_texture.json';mapping=read(table)['texture_data'].get(c['minecraft:icon']);source=gr/(mapping['textures']+'.png') if mapping else None;pic=None;sources=[table]
    if source and source.is_file():
        shutil.copyfile(source,web/f'public/images/items/{slug}.png');sources.append(source);pic={'src':f'/images/items/{slug}.png','alt':name+'のパック内画像','kind':'pack-texture'}
    add(slug,name,'item','grave',summary,'Graveのアイテム定義と使用時の処理を確認しています。鍵の種類や墓の利用条件はワールド設定に依存します。',usage,obtaining,[f"最大スタック数の設定：{c['minecraft:max_stack_size']}。",'実ゲームでの付与・開錠・移動・表示は未確認です。'],[p,*gravepaths,*sources],pic)
add('grave-appearance','墓のモデルと名前の色','feature','grave','墓の見た目を設定メニューから選ぶ。','見た目設定にはランダムなモデルと17のモデル選択肢、名前の色の選択肢を作る処理があります。','墓の見た目設定キーを使用し、モデルか名前の色を選ぶ構成です。','設定キーが必要です。モデルの実際の見た目は確認中です。',['モデル番号と外観の対応は未検証のため、プレビューは掲載していません。'],gravepaths)
add('grave-key-conditions','墓の鍵と利用条件','feature','grave','鍵の種類・所有者・ワールド設定を確認。','墓を開ける処理では手持ちの鍵と、所有者制限や名前表示などの設定を判定します。通常の鍵と移動対応の鍵では使用時の処理が異なります。','自分に付与された鍵を使う構成です。実際の利用条件はサーバーの設定に従います。','死亡後の鍵付与は設定次第です。すべての死亡で必ず鍵が届くことを確認したものではありません。',['保存アイテムの完全回収、移動先の安全性、死亡前後のアイテム収支は未検証です。'],gravepaths)
cf=web/'src/data/content-registry.json';contents=read(cf);pf=web/'src/data/pack-registry.json';packs=read(pf)
for slug,name,b,r,categories,summary,description,highlights in [
('meitetsu-chest','冥鉄の箱',bp,rp,['craft','systems'],'合言葉を設定して使う、拠点の収納。','27枠の収納、最初の管理者登録、合言葉の設定と回収操作を紹介します。6通りの製作配置を図鑑で確認できます。',['27枠の収納設定','箱ごとの合言葉','管理メニューからの回収']),
('grave','Grave / 死亡回収',gb,gr,['systems'],'死亡後の回収を支える墓と鍵。','鍵の付与、墓を開ける操作、座標移動に対応する鍵と見た目設定を紹介します。死亡時の保存・回収が実ゲームで確実に動くことを確認したものではありません。',['種類によって異なる鍵の操作','設定に応じた所有者の判定','墓のモデルと名前の色'])]:
    c=next(c for c in contents['contents'] if c['id']==slug);c.update(name=name,visibility='public',implementation='partial',deployment='repo-only',category=categories,summary=summary,description=description,image={'src':f'/images/{slug}.svg','alt':name+'の仮イラスト。実画面ではありません。','kind':'concept'},highlights=highlights,guide='関連する図鑑で、使い方・設定条件・確認できた製作方法を紹介しています。ゲーム内の操作とアイテム収支は未確認です。',children=[],related=[],packBindings=[],verification=[{'kind':'code','result':'confirmed','commit':sha},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],evidence=proof([b/'manifest.json',r/'manifest.json']))
    for kind,p in [('behavior',b),('resource',r)]:
        h=read(p/'manifest.json')['header'];reg=any(x['pack_id']==h['uuid'] and x['version']==h['version'] for x in read(repo/f'world_{kind}_packs.json'))
        if not any(x['uuid']==h['uuid'] for x in packs['packs']):packs['packs'].append(dict(uuid=h['uuid'],name=h['name'],kind=kind,version='.'.join(map(str,h['version'])),registered=reg,visibility='public'))
        c['packBindings'].append({'uuid':h['uuid'],'roles':['runtime-script'] if kind=='behavior' else ['texture','model']})
for p,data in [(file,records+new),(cf,contents),(pf,packs)]:p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Added {len(new)} entries; total {len(records+new)}.')
