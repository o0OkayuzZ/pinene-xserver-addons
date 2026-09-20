#!/usr/bin/env python3
"""Surgically merge generated Mycology content into the active BP15/RP2 packs."""
from pathlib import Path
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
BP = REPO / 'behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639'
RP = REPO / 'resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a'
GEN_BP, GEN_RP = ROOT / 'pack/BP', ROOT / 'pack/RP'


def copy_tree(source, target):
    target.mkdir(parents=True, exist_ok=True)
    for path in source.rglob('*'):
        if path.is_file():
            destination = target / path.relative_to(source)
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(path, destination)


def merge_lang(source, target):
    generated = source.read_text(encoding='utf8').splitlines()
    keys = {line.split('=', 1)[0] for line in generated if '=' in line}
    existing = target.read_text(encoding='utf8').splitlines() if target.exists() else []
    kept = [line for line in existing if '=' not in line or line.split('=', 1)[0] not in keys]
    target.write_text('\n'.join(kept + generated) + '\n', encoding='utf8')


def integrate():
    main_before = (BP / 'scripts/main.js').read_bytes()
    copy_tree(GEN_BP / 'scripts/mycology', BP / 'scripts/mycology')
    copy_tree(GEN_BP / 'items/mycology', BP / 'items/mycology')
    copy_tree(GEN_BP / 'items/mycology_tools', BP / 'items/mycology_tools')
    shutil.copyfile(GEN_BP / 'functions/mycology/give_catalog.mcfunction',
                    BP / 'functions/mycology/give_catalog.mcfunction')
    copy_tree(GEN_RP / 'textures/items/mycology', RP / 'textures/items/mycology')
    copy_tree(GEN_RP / 'textures/items/mycology_tools', RP / 'textures/items/mycology_tools')

    generated_atlas = json.loads((GEN_RP / 'textures/item_texture.json').read_text(encoding='utf8'))
    atlas_path = RP / 'textures/item_texture.json'
    atlas = json.loads(atlas_path.read_text(encoding='utf8'))
    atlas['texture_data'].update(generated_atlas['texture_data'])
    atlas_path.write_text(json.dumps(atlas, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    for locale in ['ja_JP', 'en_US']:
        merge_lang(GEN_RP / f'texts/{locale}.lang', RP / f'texts/{locale}.lang')
    assert (BP / 'scripts/main.js').read_bytes() == main_before
    print('Integrated Mycology into active BP15/RP2 without replacing manifests or unrelated atlas/lang entries')


if __name__ == '__main__':
    integrate()
