"""Reviewed geode catalogue batch. Reads game packs; writes website only."""
import json,shutil
from pathlib import Path
web=Path(__file__).resolve().parents[1];repo=web.parent
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
bp=next((repo/'behavior_packs').glob('bp_07_*'));rp=next((repo/'resource_packs').glob('rp_04_*'))
sha='aea85120954a8b74033b86253c17a04b691dab21';file=web/'src/data/field-guide.json';records=read(file);new=[]
def proof(paths):
    for p in paths:assert p.is_file(),p
    return {'commit':sha,'paths':list(dict.fromkeys(p.relative_to(repo).as_posix() for p in paths))}
def add(slug,name,kind,summary,description,usage,obtaining,details,paths,image=None):
    assert not any(e['id']==slug for e in records+new),slug
    new.append(dict(id=slug,name=name,kind=kind,contentId='more-geodes',summary=summary,description=description,usage=usage,obtaining=obtaining,details=details,image=image,recipe=None,visibility='public',evidence=proof(paths)))
langpath=rp/'texts/ja_JP.lang';lang=dict(s.split('=',1) for s in langpath.read_text(encoding='utf-8').splitlines() if '=' in s)
table=rp/'textures/item_texture.json';atlas=read(table)['texture_data']
for family,label in [('diamond','ダイヤモンド'),('emerald','エメラルド'),('rose_quartz','ローズクォーツ')]:
    blocks={}
    for p in (bp/'blocks'/family).glob('*.json'):
        d=read(p)['minecraft:block'];blocks[d['description']['identifier']]=(p,d)
    for path in sorted((bp/'items'/family).glob('*.json')):
        d=read(path)['minecraft:item'];identifier=d['description']['identifier'];c=d['components'];assert c['minecraft:block_placer']['block']==identifier
        block,definition=blocks[identifier];slug='geode-'+identifier.split(':')[1].replace('_','-')
        keys=['item.'+identifier,'item.'+identifier+'.name','tile.'+identifier,'tile.'+identifier+'.name']
        name=next((lang[k] for k in keys if k in lang),None);assert name,identifier
        size=next((text for token,text in [('small_','小さな芽'),('medium_','中くらいの芽'),('large_','大きな芽')] if token in identifier),'結晶の塊')
        mapping=atlas[c['minecraft:icon']]['textures'];assert isinstance(mapping,str)
        texture=rp/(mapping+'.png');pic=None;sources=[path,block,bp/'manifest.json',table,langpath]
        if texture.is_file():
            shutil.copyfile(texture,web/f'public/images/items/{slug}.png');sources.append(texture);pic={'src':f'/images/items/{slug}.png','alt':name+'のパック内画像','kind':'pack-texture'}
        add(slug,name,'item',label+'の'+size+'を設置するアイテム。','More Geodesの'+label+'系列です。個別アイテムから、同じIDの設置先ブロックへの対応を確認しています。','手に持ってブロックを設置する定義です。設置面による向きや見た目は実ゲームで未確認です。','入手経路と採掘条件は確認中です。生成される結晶をそのまま回収できるとは断定していません。',['この系列には小・中・大の芽と結晶の塊の定義があります。','成長速度、採掘時の報酬、道具やエンチャントの条件は未検証です。'],sources,pic)
    rule=bp/f'feature_rules/{family}_geode.json';r=read(rule)['minecraft:feature_rules'];featureid=r['description']['places_feature']
    candidates=[p for p in (bp/'features').glob('*.json') if read(p).get('minecraft:geode_feature',{}).get('description',{}).get('identifier')==featureid];assert len(candidates)==1
    feature=candidates[0];f=read(feature)['minecraft:geode_feature'];assert r['distribution']['y']['extent']==[-30,30]
    assert f['inner_layer'] in blocks and f['alternate_inner_layer'] in blocks
    assert f['middle_layer']=='minecraft:calcite'
    outer={'minecraft:obsidian':'黒曜石','minecraft:smooth_basalt':'滑らかな玄武岩'}[f['outer_layer']]
    add('geode-generation-'+family.replace('_','-'),label+'ジオードの生成設定','feature',label+'の結晶を含む空洞の生成候補。',f'ジオードの内側に結晶ブロックと芽生えた結晶を使い、中間層に方解石、外側に{outer}を使う定義です。','探索で出会う地形候補として紹介しています。すでに生成済みの場所に新しく出現することを確認したものではありません。','生成候補の高さはY=-30〜30の設定です。空洞全体がこの範囲だけに収まることや、必ず見つかることを保証する値ではありません。',['小さな結晶の芽を内側へ配置する定義があります。','生成頻度・実際の場所・成長・採掘による入手はゲーム内で未確認です。'],[rule,feature,blocks[f['inner_layer']][0],blocks[f['alternate_inner_layer']][0],bp/'manifest.json'])
cf=web/'src/data/content-registry.json';contents=read(cf);pf=web/'src/data/pack-registry.json';packs=read(pf)
c=next(c for c in contents['contents'] if c['id']=='more-geodes')
c.update(name='More Geodes',visibility='public',implementation='partial',deployment='repo-only',category=['exploration','world'],summary='地下に広がる、さまざまな結晶の空洞。',description='ダイヤモンド・エメラルド・ローズクォーツの3系列を紹介します。結晶の芽と塊の設置アイテム、ジオードの生成設定を個別の図鑑で確認できます。',image={'src':'/images/more-geodes.svg','alt':'結晶の空洞を描いた仮イラスト。実画面ではありません。','kind':'concept'},highlights=['3系列・12種類の結晶アイテム','小・中・大の芽と結晶の塊','結晶を含むジオードの生成設定'],guide='関連する図鑑で、設置アイテムと生成候補を紹介しています。採掘による入手と成長条件は未確認です。',children=[],related=[],packBindings=[],verification=[{'kind':'code','result':'confirmed','commit':sha},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],evidence=proof([bp/'manifest.json',rp/'manifest.json']))
for kind,p in [('behavior',bp),('resource',rp)]:
    h=read(p/'manifest.json')['header'];reg=any(x['pack_id']==h['uuid'] and x['version']==h['version'] for x in read(repo/f'world_{kind}_packs.json'))
    if not any(x['uuid']==h['uuid'] for x in packs['packs']):packs['packs'].append(dict(uuid=h['uuid'],name=h['name'],kind=kind,version='.'.join(map(str,h['version'])),registered=reg,visibility='public'))
    c['packBindings'].append({'uuid':h['uuid'],'roles':['item-definition','worldgen'] if kind=='behavior' else ['texture','model']})
for p,data in [(file,records+new),(cf,contents),(pf,packs)]:p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f'Added {len(new)} entries; total {len(records+new)}.')
