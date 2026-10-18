"""Install only Sans into the established closed development world.

JSON is handled by Python: Windows PowerShell 5 may wrap a parsed array with
`value`/`Count` metadata when passing it through a pipeline and serializing it.
"""
from pathlib import Path
from datetime import datetime
import json
import os
import shutil
import subprocess

def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def closed():
    rows = subprocess.check_output(['tasklist','/FI','IMAGENAME eq Minecraft.Windows.exe','/FO','CSV','/NH'])
    if b'minecraft.windows.exe' in rows.lower():
        raise RuntimeError('Close Minecraft completely, then run this installer again.')

def atomic_write(path, data):
    temporary = path.with_name(path.name+'.sans-tmp')
    temporary.write_bytes(data)
    os.replace(temporary,path)

def install(source, base, world, check_closed=closed):
    check_closed()
    if (world/'levelname.txt').read_text(encoding='utf-8-sig').strip() != '\u958b\u767a\u7528\u30ef\u30fc\u30eb\u30c9':
        raise RuntimeError('Development world identity did not match. No changes made.')
    plans=[]
    for kind,short in [('behavior','BP'),('resource','RP')]:
        pack=source/short
        target=base/f'development_{kind}_packs/Pinene_Sans_Boss_{short}'
        manifest=load(pack/'manifest.json')['header']
        path=world/f'world_{kind}_packs.json'
        original=path.read_bytes()
        refs=json.loads(original.decode('utf-8-sig'))
        if not isinstance(refs,list) or not all(isinstance(row,dict) and isinstance(row.get('pack_id'),str)
                and isinstance(row.get('version'),list) and len(row['version'])==3 for row in refs):
            raise ValueError(f'Invalid pack-list structure: {path.name}. No changes made.')
        if target.exists() and load(target/'manifest.json')['header']['uuid']!=manifest['uuid']:
            raise ValueError('Destination pack UUID conflict. No changes made.')
        updated=[{'pack_id':manifest['uuid'],'version':manifest['version']}]
        updated += [row for row in refs if row['pack_id']!=manifest['uuid']]
        plans.append((pack,target,path,original,updated))
    backup=base/'debug_backups'/('sans_install_'+datetime.now().strftime('%Y%m%d_%H%M%S_%f'))
    backup.mkdir(parents=True,exist_ok=False)
    for pack,target,path,original,updated in plans:
        (backup/path.name).write_bytes(original)
        shutil.copytree(pack,target,dirs_exist_ok=True)
    check_closed()
    try:
        for pack,target,path,original,updated in plans:
            atomic_write(path,(json.dumps(updated,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
        for pack,target,path,original,updated in plans:
            assert load(path)==updated, path
    except Exception:
        for pack,target,path,original,updated in plans:atomic_write(path,original)
        raise
    return backup

if __name__=='__main__':
    source=Path(__file__).resolve().parents[1]
    roaming=Path(os.environ['APPDATA'])/'Minecraft Bedrock/Users'
    base=roaming/'Shared/games/com.mojang'
    world=roaming/'10345784260749742919/games/com.mojang/minecraftWorlds/8v9pvwiD6QQ='
    backup=install(source,base,world)
    print(f'Sans installed into development world. Backup: {backup}')
    print('Summon: /summon pinene_sans:sans ~ ~ ~')
