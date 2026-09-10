"""Reviewed discovery batch. Writes only website data and selected images."""
import json,re,shutil
from pathlib import Path
web=Path(__file__).resolve().parents[1];repo=web.parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def pack(kind,n):return next((repo/f'{kind}_packs').glob(f'{"bp" if kind=="behavior" else "rp"}_{n:02d}_*'))
ab,ar=pack('behavior',3),pack('resource',16)
core,extra,rp,figrp=pack('behavior',15),pack('behavior',6),pack('resource',2),pack('resource',5)
sha='aea85120954a8b74033b86253c17a04b691dab21';file=web/'src/data/field-guide.json';records=read(file);new=[]
def proof(paths):
    for p in paths:assert p.is_file(),p
    return {'commit':sha,'paths':list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
def add(slug,name,kind,owner,summary,description,usage,obtaining,details,paths,image=None,recipe=None):
    assert not any(e['id']==slug for e in records+new),slug
    e=dict(id=slug,name=name,kind=kind,contentId=owner,summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=recipe,visibility='public',evidence=proof(paths));new.append(e);return e
def texture(resource,c,slug):
    table=resource/'textures/item_texture.json';icon=c['minecraft:icon'];key=icon if isinstance(icon,str) else icon['textures']['default'];path=resource/(read(table)['texture_data'][key]['textures']+'.png')
    if not path.is_file():return None,[table]
    shutil.copyfile(path,web/f'public/images/items/{slug}.png')
    return {'src':f'/images/items/{slug}.png','alt':'パック内のアイテム画像','kind':'pack-texture'},[table,path]
script=ab/'scripts/main.js';source=script.read_text(encoding='utf-8');targets={};names={'minecraft:diamond':'ダイヤモンド','minecraft:diamond_block':'ダイヤモンドブロック'}
effects={'regeneration':'再生','water_breathing':'水中呼吸','night_vision':'暗視','speed':'移動速度上昇','absorption':'衝撃吸収','resistance':'耐性','conduit_power':'コンジットパワー'}
for stem in ['blue_apple','blue_diamond_apple','enchanted_blue_diamond_apple']:
    path=ab/f'items/{stem}.item.json';d=read(path)['minecraft:item'];c=d['components'];identifier=d['description']['identifier'];name=c['minecraft:display_name']['value'];slug=stem.replace('_','-');names[identifier]=name
    details=[f"満腹度の回復設定：{c['minecraft:food']['nutrition']}。満腹度の上限を超えて蓄えられることを示す値ではありません。"]
    match=re.search('"'+re.escape(identifier)+r'":\s*\[([^\]]+)\]',source)
    if match:
        for effect,duration,amp in re.findall(r'id: "([a-z_]+)", duration: (\d+), amplifier: (\d+)',match[1]):details.append(f'付与する効果の設定：{effects[effect]} レベル{int(amp)+1}・{int(duration)//20}秒。')
    else:details.append('このアイテムは食事効果の追加処理の対象に入っていません。')
    pic,sources=texture(ar,c,slug)
    targets[identifier]=add(slug,name,'item','blue-apple','葉から見つかる、強化の土台になる青りんご。' if not match else 'ダイヤ素材で強化する、効果付きの青りんご。','Blue Appleの食料です。個別定義と、このアイテムIDを対象にした食事処理を照合しています。','手に持って食べる設定です。満腹時にも使用を許可しています。効果の実際の発動は未確認です。','オーク・ダークオークの葉をプレイヤーが壊したときの抽選対象です。' if not match else '関連する作業台レシピで材料と配置を確認できます。',details,[path,ab/'manifest.json',script,*sources],pic)
for stem in ['blue_diamond_apple','enchanted_blue_diamond_apple']:
    p=ab/f'recipes/{stem}.recipe.json';r=read(p)['minecraft:recipe_shaped'];target=targets[r['result']['item']]
    grid=[[names[r['key'][s]['item']] for s in row] for row in r['pattern']];materials=[n for row in grid for n in row]
    add('craft-'+target['id'],target['name']+'のレシピ','recipe','blue-apple','青りんごをダイヤ素材で囲んで強化。','作業台用の材料・配置・完成品を定義から確認しました。','下の配置に合わせて材料を作業台へ並べる設定です。','材料の実際の入手とクラフト動作は未確認です。',[],[p],recipe={'shaped':True,'grid':grid,'ingredients':[{'name':n,'count':materials.count(n)} for n in dict.fromkeys(materials)],'resultId':target['id'],'count':r['result']['count']})
assert 'const DROP_CHANCE = 0.0001;' in source
add('blue-apple-leaf-drop','葉からの青りんご抽選','feature','blue-apple','オークとダークオークの葉を壊すと抽選。','プレイヤーのブロック破壊イベントで葉の種類を確認し、青りんごを1個出す抽選を行う処理です。','対象の葉をプレイヤーが壊したときに判定します。自然消滅時の処理ではありません。','1回の対象イベントにつき確率0.0001（0.01%）の設定です。実測値ではありません。',['木を何本切れば必ず入手できる、という保証ではありません。'],[script,ab/'manifest.json'])
main=core/'scripts/main.js';maintext=main.read_text(encoding='utf-8');langpath=rp/'texts/ja_JP.lang';lang=dict(line.split('=',1) for line in langpath.read_text(encoding='utf-8').splitlines() if '=' in line)
for stem in ['figure_fossil','figure_spiral','figure_oyu']:
    p=(extra if stem=='figure_spiral' else core)/f'items/{stem}.item.json';d=read(p)['minecraft:item'];c=d['components'];identifier=d['description']['identifier'];name=lang[c['minecraft:display_name']['value']];slug=stem.replace('_','-')
    assert f'itemId: "{identifier}"' in maintext
    entity=extra/f'entities/{stem}_placed.json';assert read(entity)['minecraft:entity']['description']['identifier']==identifier+'_placed'
    pic,sources=texture(figrp,c,slug)
    add(slug,name,'item','figures','集めて置ける、小さな展示用フィギュア。',name+'は設置用エンティティと対応付けられた収集アイテムです。見た目の実ゲーム確認はまだ行っていません。','ブロックに向かって使用して設置する処理があります。設置済みの個体は攻撃、またはしゃがんで操作すると回収する処理です。','謎の化石の抽選報酬に登録されています。必ず手に入る報酬ではありません。',['最大スタック数の設定：1。','設置・回収の実動作やアイテム収支は未確認です。'],[p,entity,core/'manifest.json',main,langpath,*sources],pic)
add('figure-placement-pickup','フィギュアの設置と回収','feature','figures','集めたフィギュアを飾り、場所を変えて楽しむ。','手持ちアイテムを設置用エンティティに変え、回収時にアイテムを出す処理です。','ブロックに使用して設置します。攻撃や、しゃがんでの操作を回収の入口にしています。','対応するフィギュアアイテムが必要です。',['設置時の向きはプレイヤーの向きをもとに調整する処理があります。','実ゲームでの向き・見た目・重複回収の有無は未検証です。'],[core/'manifest.json',main])
p=core/'items/mystery_fossil.item.json';block=extra/'blocks/mystery_fossil.block.json';assert read(p)['minecraft:item']['components']['minecraft:block_placer']['block']=='myname:mystery_fossil'
add('mystery-fossil','謎の化石','item','mystery-fossil','ブラシで調べる処理につながる、設置用の化石。','アイテムは謎の化石ブロックを置く定義です。食料や装備とは別の、調査用ブロックとして扱います。','設置した謎の化石に、ブラシを持って操作する処理があります。','化石の抽選報酬に登録されています。自然生成の場所や採掘での入手条件は確認中です。',['最大スタック数の設定：64。','設置・調査と本番での入手は未確認です。'],[p,block,main,core/'manifest.json'])
add('mystery-fossil-brushing','ブラシで化石を調べる','feature','mystery-fossil','ブラシで調べ、抽選報酬を見つける。','怪しげな砂、または謎の化石をブラシで操作すると演出処理を開始し、終了時に報酬を抽選する構成です。','対象ブロックへブラシを持って操作します。通常の発掘操作と同じ所要時間とは断定していません。','対象のブロックとブラシが必要です。抽選にはフィギュアや謎の化石などが含まれます。',['完了時に対象ブロックを空気へ変える処理があります。','演出、報酬の入手、経験値の量と収支はゲーム内で未確認です。'],[core/'manifest.json',main,block])
cf=web/'src/data/content-registry.json';contents=read(cf);pf=web/'src/data/pack-registry.json';packs=read(pf)
for slug,title,bindings,categories,summary,description,highlights in [
('blue-apple','Blue Apple',[(ab,'behavior'),(ar,'resource')],['exploration','craft'],'葉から見つけ、ダイヤで強化する青りんご。','青りんごと2段階の強化食料を紹介します。葉を壊したときの抽選、作業台レシピ、追加効果をアイテムIDごとに確認しています。',['葉からの低確率の抽選','ダイヤ素材で2段階に強化','種類ごとの食事効果']),
('mystery-fossil','謎の化石',[(core,'behavior'),(extra,'behavior'),(rp,'resource')],['exploration','collection'],'ブラシで調べ、埋もれた発見を探そう。','謎の化石の設置アイテムと、ブラシ操作から抽選報酬へ進む処理を紹介します。実際の生成場所・演出・入手は未確認です。',['ブラシを使う調査','フィギュアなどの抽選報酬','設置用の化石アイテム']),
('figures','フィギュア',[(core,'behavior'),(extra,'behavior'),(rp,'resource'),(figrp,'resource')],['collection','world'],'集めたフィギュアを、自分の場所に飾ろう。','確認済みの化石・らせん・おゆの3種類と、共通の設置・回収処理を紹介します。ほかの種類は今後の確認対象です。',['3種類のフィギュアを紹介','手に持って使う設置操作','攻撃やしゃがみ操作で回収'])]:
    c=next(c for c in contents['contents'] if c['id']==slug)
    c.update(name=title,visibility='public',implementation='partial',deployment='repo-only',category=categories,summary=summary,description=description,image={'src':f'/images/{slug}.svg','alt':title+'の仮イラスト。実画面ではありません。','kind':'concept'},highlights=highlights,guide='関連図鑑で使い方と確認できた入手条件を紹介します。ゲーム内動作と本番の提供範囲は未確認です。',children=[],related=[],packBindings=[],verification=[{'kind':'code','result':'confirmed','commit':sha},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],evidence=proof([p/'manifest.json' for p,k in bindings]))
    for p,kind in bindings:
        h=read(p/'manifest.json')['header'];reg=any(x['pack_id']==h['uuid'] and x['version']==h['version'] for x in read(repo/f'world_{kind}_packs.json'))
        if not any(x['uuid']==h['uuid'] for x in packs['packs']):packs['packs'].append(dict(uuid=h['uuid'],name=h['name'],kind=kind,version='.'.join(map(str,h['version'])),registered=reg,visibility='public'))
        c['packBindings'].append({'uuid':h['uuid'],'roles':['item-definition','runtime-script'] if kind=='behavior' else ['texture']})
for p,data in [(file,records+new),(cf,contents),(pf,packs)]:p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Added {len(new)} entries; total {len(records+new)}.')
