"""Install only the opt-in persistent UI prototype; preserve local UI v2 edits."""
from __future__ import annotations
import argparse, datetime, hashlib, json, os, pathlib

UUID = '211f47f7-5f1d-4b02-a162-e7546cf3fdc4'
MODULES = ('custom_cooking_ui.js', 'custom_cooking_bridge.js')
IMPORT = 'import * as customFormApi from "@minecraft/server-ui";\nimport { createCustomCookingBridge } from "./custom_cooking_bridge.js";\n'
GUARD = '''  // Opt-in native CustomForm probe; legacy UI remains available.
  if (customCookingUi.enabled(player)) {
    const result = await customCookingUi.openAt(player, block);
    if (result.opened || !["unsupported_api", "open_error"].includes(result.reason)) return;
    player.sendMessage("新しい料理UIを開けなかったため、通常の画面に戻します。");
  }
'''
BRIDGE = '''const customCookingUi = createCustomCookingBridge({
  ui: customFormApi, system, world, recipes: COOKING_RECIPES,
  inventory, countIngredient, countItem, canCraftRecipe, craftCookingRecipe,
  knifeRankLimit, isBoardId, KNIFE_BY_PLACED, ItemStack, CONTAINER_RETURNS,
});

'''

def digest(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()

def patched_main(s: str) -> str:
    if 'createCustomCookingBridge' in s:
        raise ValueError('Prototype already present. Refusing to overwrite a parallel revision.')
    anchor = 'async function openBoard(player, block, state = {}) {\n'
    event = 'world.beforeEvents.playerInteractWithBlock.subscribe((event) => {'
    if s.count(anchor) != 1 or s.count(event) != 1:
        raise ValueError('Main entry anchors changed; review required.')
    return IMPORT + s.replace(anchor, anchor + GUARD, 1).replace(event, BRIDGE + event, 1)

def replace(path: pathlib.Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(path.name + '.customform-stage')
    tmp.write_bytes(data)
    os.replace(tmp, path)

def install(pack: pathlib.Path, source: pathlib.Path, backup_root: pathlib.Path) -> pathlib.Path:
    pack = pack.resolve(); source = source.resolve()
    manifest_path = pack / 'manifest.json'
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes.decode('utf-8-sig'))
    if manifest['header']['uuid'] != UUID:
        raise ValueError('Unexpected pack UUID; no files changed.')
    deps = [d for d in manifest.get('dependencies', []) if d.get('module_name') == '@minecraft/server-ui']
    if len(deps) != 1 or deps[0]['version'] not in ('2.0.0', '2.1.0', '2.2.0'):
        raise ValueError('Unexpected API dependency; no files changed.')
    deps[0]['version'] = '2.2.0'
    main_path = pack / 'scripts/main.js'
    main_bytes = main_path.read_bytes()
    changes = {
        'manifest.json': (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode('utf-8'),
        'scripts/main.js': patched_main(main_bytes.decode('utf-8-sig').replace('\r\n', '\n')).encode('utf-8'),
    }
    for name in MODULES:
        target = pack / 'scripts' / name
        if target.exists(): raise ValueError(f'{name} already exists; refusing overwrite.')
        changes['scripts/' + name] = (source / name).read_bytes()
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup = backup_root / ('backup-' + stamp)
    backup.mkdir(parents=True)
    originals = {}
    entries = []
    for relative, data in changes.items():
        path = pack / relative
        old = path.read_bytes() if path.exists() else None
        originals[relative] = old
        if old is not None:
            saved = backup / relative; saved.parent.mkdir(parents=True, exist_ok=True); saved.write_bytes(old)
        entries.append({'path': relative, 'before': digest(old) if old is not None else None, 'after': digest(data)})
    record = {'pack': str(pack), 'files': entries, 'note': 'Local opt-in probe, not production deployment'}
    (backup / 'record.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
    try:
        for relative, data in changes.items(): replace(pack / relative, data)
    except Exception:
        for relative, old in originals.items():
            if old is None: (pack / relative).unlink(missing_ok=True)
            else: replace(pack / relative, old)
        raise
    return backup

def rollback(backup: pathlib.Path) -> None:
    record = json.loads((backup / 'record.json').read_text(encoding='utf-8'))
    pack = pathlib.Path(record['pack'])
    for entry in record['files']:
        path = pack / entry['path']
        if not path.exists() or digest(path.read_bytes()) != entry['after']:
            raise ValueError('Files changed after install; refusing destructive rollback: ' + str(path))
    for entry in record['files']:
        path = pack / entry['path']
        if entry['before'] is None: path.unlink()
        else: replace(path, (backup / entry['path']).read_bytes())

if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--pack', type=pathlib.Path)
    p.add_argument('--rollback', type=pathlib.Path)
    a = p.parse_args()
    here = pathlib.Path(__file__).resolve().parent
    if a.rollback:
        rollback(a.rollback); print('ROLLBACK_OK')
    elif a.pack:
        backup = install(a.pack, here, here)
        print('INSTALL_OK'); print('BACKUP=' + str(backup))
    else: p.error('--pack or --rollback is required')
