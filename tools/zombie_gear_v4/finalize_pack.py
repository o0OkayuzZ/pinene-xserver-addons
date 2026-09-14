from pathlib import Path
import json, shutil
root=Path(__file__).resolve().parents[2]
bp=root/'behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1'
rp=root/'resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10'
source=root/'docs/zombie_gear_final/handoff'
names=(source/'data/ja_JP_zombiegear.lang').read_text(encoding='utf-8').splitlines()
for locale in ['ja_JP','en_US']:
    f=rp/f'texts/{locale}.lang'
    lines=f.read_text(encoding='utf-8-sig').splitlines() if f.exists() else []
    keys={x.split('=',1)[0] for x in names}
    lines=[x for x in lines if x.split('=',1)[0] not in keys]
    if locale=='ja_JP':lines+=names
    else:
        for part in ['helmet','chestplate','leggings','boots']:
            for c in range(5):
                suffix=f'_c{c}' if c else ''
                lines.append(f'item.zombiegear:zombie_{part}{suffix}.name=Zombie {part.title()}'+(f' (Corruption {c})' if c else ''))
    f.write_text('\n'.join(lines)+'\n',encoding='utf-8')
versions={}
for pack in [bp,rp]:
    f=pack/'manifest.json';m=json.loads(f.read_text(encoding='utf-8-sig'));v=[1,2,0]
    versions[m['header']['uuid']]=v;m['header']['version']=v
    for x in m['modules']:x['version']=v
    f.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for f in [bp/'manifest.json',rp/'manifest.json']:
    m=json.loads(f.read_text(encoding='utf-8'))
    for x in m.get('dependencies',[]):
        if x.get('uuid') in versions:x['version']=versions[x['uuid']]
    f.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for prefix in ['', 'worlds/Bedrock level/']:
    for kind in ['behavior','resource']:
        f=root/f'{prefix}world_{kind}_packs.json';m=json.loads(f.read_text(encoding='utf-8-sig'))
        for x in m:
            if x['pack_id'] in versions:x['version']=versions[x['pack_id']]
        f.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('20 variants localized; BP/RP/registrations synchronized at 1.2.0')
