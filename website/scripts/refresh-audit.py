"""Read-only repository audit; writes only curated website data and audit evidence."""
import json, pathlib, subprocess
web = pathlib.Path(__file__).resolve().parents[1]
repo = web.parent
sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip()
def read(path): return json.loads(path.read_text(encoding='utf-8-sig'))
def save(path, data): path.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
specs = [
 ('pvp-island','PvP Island',['combat','world'], '島を舞台にした、独立したPvPコンテンツ。', '島の生成や保護、能力の制御を扱うコンテンツです。通常世界での利用条件や参加手順は確認中です。', [('behavior',17,['runtime-script','behavior']),('resource',20,['texture','model'])], ['scripts/main.js','scripts/pvp_island/ability_router.js'], ['島の生成・保護を扱うスクリプト','アイテム使用時の能力を振り分ける仕組み']),
 ('infinite-castle','無限城',['exploration','world'], 'つながる部屋を探索する、独自のダンジョン。', '部屋の接続とダンジョン生成を扱うコンテンツです。PvP Islandとは別のコンテンツとして紹介しています。深層や報酬の提供状況は確認中です。', [('behavior',16,['runtime-script','behavior']),('resource',19,['texture','model'])], ['scripts/main.js','scripts/infinite_castle/infiniteCastleManager.js'], ['部屋の接続を管理する仕組み','ダンジョン生成・再構築の処理']),
 ('minecraft-dungeons','Minecraft Dungeons',['combat','exploration','collection'], 'Mobや装備を中心に広がる、冒険のコンテンツ。', 'Minecraft Dungeonsを題材とした追加コンテンツです。リポジトリ内にMobと装備の定義があります。自然出現・入手条件・本番での提供範囲は確認中です。', [('behavior',8,['behavior','item-definition']),('resource',6,['texture','model'])], ['manifest.json'], ['Mobの定義','装備・アイテムの定義']),
 ('mycology','Mycology',['collection','exploration','systems'], 'キノコと出会い、鑑定や図鑑を楽しむ仕組み。', 'キノコの鑑定と図鑑を扱うコンテンツです。現行コードに鑑定UI、図鑑、効果処理への接続を確認しています。入手方法とゲーム内での動作は確認中です。', [('behavior',15,['runtime-script','item-definition']),('resource',2,['texture','model'])], ['scripts/main.js','scripts/mycology/index.js','scripts/mycology/field_guide.js'], ['キノコの鑑定UI','キノコ図鑑の仕組み']),
]
packs=[]; contents=[]; evidence=[]
for slug,name,cats,summary,description,bindings,paths,highlights in specs:
  pack_bindings=[]; sources=[]
  for kind,number,roles in bindings:
    prefix='bp' if kind=='behavior' else 'rp'
    folder=next((repo/f'{kind}_packs').glob(f'{prefix}_{number:02d}_*'))
    manifest=read(folder/'manifest.json'); header=manifest['header']
    registration=read(repo/f'world_{kind}_packs.json')
    matches=[r for r in registration if r['pack_id']==header['uuid']]
    registered=any(r['version']==header['version'] for r in matches)
    pack={'uuid':header['uuid'],'name':name+' '+prefix.upper(),'kind':kind,'version':'.'.join(map(str,header['version'])),'registered':registered,'visibility':'public'}
    if not any(p['uuid']==pack['uuid'] for p in packs): packs.append(pack)
    pack_bindings.append({'uuid':header['uuid'],'roles':roles})
    sources.append(str((folder/'manifest.json').relative_to(repo)).replace('\\','/'))
    if kind=='behavior':
      sources.extend(str((folder/p).relative_to(repo)).replace('\\','/') for p in paths)
  for source in sources: assert (repo/source).is_file(), source
  contents.append({'id':slug,'name':name,'summary':summary,'description':description,'category':cats,'visibility':'public','implementation':'partial','deployment':'repo-only','verification':[{'kind':'code','result':'confirmed','commit':sha},{'kind':'registration','result':'confirmed' if all(next(p for p in packs if p['uuid']==b['uuid'])['registered'] for b in pack_bindings) else 'unknown','commit':sha},{'kind':'server-start','result':'unknown'},{'kind':'gameplay','result':'unknown'},{'kind':'appearance','result':'unknown'}],'image':{'src':f'/images/{slug}.svg','alt':name+'をイメージした仮イラスト。実際のゲーム画面ではありません。','kind':'concept'},'highlights':highlights,'guide':'参加・入手の手順は確認中です。公開が確認できた案内を順次追加します。','children':[],'related':['minecraft-dungeons'] if slug=='infinite-castle' else [],'packBindings':pack_bindings,'evidence':{'commit':sha,'paths':sources}})
  evidence.append({'content':slug,'commit':sha,'paths':sources})
# Unverified snapshot candidates remain draft with their stable slugs, without old claims.
old=read(web/'src/data/content-registry.json')['contents']
for candidate in old:
  if candidate['id'] not in {c['id'] for c in contents}:
    contents.append({'id':candidate['id'],'name':candidate['name'],'visibility':'draft','implementation':'unknown','deployment':'unknown','category':[],'packBindings':[],'related':[],'verification':[]})
save(web/'src/data/content-registry.json', {'schema_version':'0.2.0','source_commit':sha,'contents':contents})
save(web/'src/data/pack-registry.json', {'schema_version':'0.2.0','source_commit':sha,'packs':packs})
save(web/'src/data/updates.json', [])
save(web/'audit/source-evidence.json', evidence)
print(f'Audited {len(specs)} contents; {len(packs)} selected packs; source {sha}')

