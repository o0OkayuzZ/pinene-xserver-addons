"""Update the public release record without replacing curated guide content."""
from pathlib import Path
import json,subprocess

web=Path(__file__).resolve().parents[1];repo=web.parent
def read(name):return json.loads((web/'src/data'/name).read_text(encoding='utf8'))
def save(name,obj):(web/'src/data'/name).write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
manifests={}
for kind in ['behavior','resource']:
    for path in (repo/(kind+'_packs')).glob('*/manifest.json'):
        m=json.loads(path.read_text(encoding='utf-8-sig'));manifests[m['header']['uuid']]=m['header']
active={entry['pack_id'] for kind in ['behavior','resource'] for entry in json.loads((repo/f'world_{kind}_packs.json').read_text(encoding='utf-8-sig'))}
registry=read('pack-registry.json')
for pack in registry['packs']:
    header=manifests.get(pack['uuid'])
    if header:
        pack['version']='.'.join(map(str,header['version']))
        pack['registered']=pack['uuid'] in active
    elif pack['uuid']=='3554695d-d627-4971-8420-dc4ece2f8613':
        pack['registered']=False
registry['source_commit']=subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip()
save('pack-registry.json',registry)
updates=[u for u in read('updates.json') if u['id']!='nf-common-20260921']
updates.insert(0,{
    'id':'nf-common-20260921','title':'キノコを続けて食べられるようになりました',
    'body':'食用キノコ32種の食後の待ち時間をなくしました。食べる動作の時間や既存の効果はそのままです。NFの効果追加に向けた共通基盤も準備しましたが、個体別の未確定な性能は追加していません。パック整理と参照バージョンの更新も反映しました。',
    'date':'2026-09-21','visibility':'public'
})
save('updates.json',updates)
print('Updated NF common release record and current pack versions')
