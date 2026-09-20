"""Refresh version records and release news without rebuilding curated guides."""
from pathlib import Path
import json,subprocess
web=Path(__file__).resolve().parents[1];repo=web.parent
revision=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
def read(name):return json.loads((web/'src/data'/name).read_text(encoding='utf8'))
def save(name,obj):(web/'src/data'/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
manifests={}
for kind in ['behavior','resource']:
 for path in (repo/(kind+'_packs')).glob('*/manifest.json'):
  m=json.loads(path.read_text(encoding='utf-8-sig'));manifests[m['header']['uuid']]=m['header']
registry=read('pack-registry.json')
for pack in registry['packs']:
 header=manifests.get(pack['uuid'])
 if header:pack['version']='.'.join(map(str,header['version']))
registry['source_commit']=revision;save('pack-registry.json',registry)
updates=read('updates.json');updates=[u for u in updates if u['id']!='release-20260920']
updates.insert(0,{'id':'release-20260920','title':'NF100種・描画対応・墓の判定を更新','body':'NF-001〜100のアイテム・鑑定・図鑑を反映しました。サーバーで鮮やかなビジュアルを選べない問題を修正し、影と反射の復帰を確認しました。墓の生成判定と復活時の状態処理を更新し、鉱石の結晶ドロップ調整も反映しています。墓の生成・回収はゲーム内で確認中です。','date':'2026-09-20','visibility':'public'})
save('updates.json',updates)
print('Updated pack versions and September 20 release news:',revision)
