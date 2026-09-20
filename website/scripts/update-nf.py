"""Publish the approved NF registry and sprites without creating gameplay effects."""
from pathlib import Path
import json, shutil, subprocess
WEB=Path(__file__).resolve().parents[1]; REPO=WEB.parent
def read(p):return json.loads(p.read_text(encoding='utf8'))
def save(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=REPO,text=True).strip()
nf=read(REPO/'tools/mycology/data/nether_fungi_master_v1.0.json')['entries']
bp='behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639'
rp='resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a'
path=WEB/'src/data/field-guide.json'; rows=read(path)
rows=[r for r in rows if not r['id'].startswith('mycology-nf-')]
for e in nf:
 slug=f"nf_{e['number']:03d}"; ident=f"mycology-nf-{e['number']:03d}"
 image=f'/images/items/{ident}.png'
 shutil.copyfile(REPO/f'{rp}/textures/items/mycology/nf/{slug}.png',WEB/'public'/image.lstrip('/'))
 rows.append(dict(id=ident,name=e['display_name'],kind='item',contentId='mycology',
  summary=f"{e['id']}・{e['family_ja']}系統の菌茸標本。",
  description=f"{e['scientific_name']}を元ネタとするNF菌茸です。正式分類は{e['family_ja']}、レア度は★{e['stars']}です。",
  usage='図鑑に収集する標本です。摂食性能・特殊効果はまだ設定されていません。',
  obtaining=f"{e['family_ja']}のキノコを鑑定すると抽選で入手できます。",
  details=[f"図鑑番号：{e['id']}",f"元ネタ：{e['common_name']}（{e['scientific_name']}）",f"系統：{e['family_ja']}", 'ゲーム内で鑑定すると自分の図鑑へ登録されます。'],
  image=dict(src=image,alt=e['display_name']+'の正式アイテム画像',kind='pack-texture'),recipe=None,visibility='public',
  evidence=dict(commit=commit,paths=[f'{bp}/items/mycology/nf/{slug}.json',f'{bp}/scripts/mycology/registry.js',f'{rp}/textures/items/mycology/nf/{slug}.png'])))
for e in rows:
 if e['id']=='golden-food-guide' and 'アイテムにはグリント（光沢）が付きます。' not in e['details']:
  e['details'].append('アイテムにはグリント（光沢）が付きます。')
 if e['id']=='mushroom-discoveries':
  e['details']=['赤色15種・茶色20種・深紅50種・歪んだ50種の合計135種。','一覧は10種ずつ。未発見の名前と画像は伏せられます。','Webの一覧はゲーム内の個人の発見状況とは連動していません。']
 if e['id']=='mushroom-appraisal':
  e['obtaining']='赤色・茶色のキノコ、深紅・歪んだキノコを用意し、鑑定士から対応カテゴリを選びます。'
 if e['contentId']=='mycology':
  for field in ['description','summary','usage']:
   e[field]=e[field].replace('35種類','135種類').replace('合計35種','合計135種')
save(path,rows)
path=WEB/'src/data/exploration-guides.json';groups=read(path)
g=next(g for g in groups if g['contentId']=='mycology')
g['intro']='赤色15種・茶色20種とNF菌茸100種、合計135種の図鑑です。Webの一覧はゲーム内の個人の発見状況とは連動していません。'
g['groups']=[g for g in g['groups'] if g['id'] not in ['crimson','warped']]
for family,title in [('crimson','深紅のNF菌茸'),('warped','歪んだNF菌茸')]:
 g['groups'].append(dict(id=family,title=title,entries=[f"mycology-nf-{e['number']:03d}" for e in nf if e['family']==family]))
save(path,groups)
path=WEB/'src/data/content-registry.json';data=read(path);c=next(c for c in data['contents'] if c['id']=='mycology')
c['description']='赤色・茶色のキノコと深紅・歪んだキノコを鑑定し、合計135種の発見を自分の図鑑に集めます。NF菌茸100種は正式なアイテム画像を掲載しています。NFの摂食性能・特殊効果はまだ設定されていません。'
c['highlights'][0]='赤色15種・茶色20種・深紅50種・歪んだ50種。未発見の名前と画像はゲーム内図鑑で伏せて表示します。'
c['guide']=c['guide'].replace('赤色または茶色のキノコ','赤色・茶色・深紅・歪んだキノコ').replace('鑑定する色','鑑定するカテゴリ')
c['evidence']['commit']=commit
save(path,data)
print('Added 100 official NF entries/images and two guide categories')
