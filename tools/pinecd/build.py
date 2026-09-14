"""Build PineCD data assets. No runtime scripts, deployment or world edits."""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BP = ROOT / 'behavior_packs/bp_04_b29dadb1-6c0e-42f6-a56e-f52e01dff8e9'
RP = ROOT / 'resource_packs/rp_01_1497b511-a764-46d4-b726-dd0f5c5d7784'


def load(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))


def outputs():
    tracks = load(Path(__file__).with_name('tracks.json'))['tracks']
    atlas = load(RP / 'textures/item_texture.json')
    definitions = {}
    result = {}
    ids, icons, filenames = set(), set(), set()
    for t in tracks:
        ident, event = t['id'], t['sound_event']
        assert re.fullmatch(r'pinecd:[a-z0-9_]+', ident) and ident not in ids, ident
        assert event.startswith('pinecd.record.') and event not in definitions, event
        assert t['icon'] not in icons, t['icon']
        ids.add(ident)
        icons.add(t['icon'])
        for path, suffix in [(t['sound'], '.ogg'), (t['texture'], '.png')]:
            asset = (RP / (path + suffix)).resolve()
            assert asset.is_relative_to(RP) and asset.is_file(), asset
        assert 1 <= t['comparator_signal'] <= 13
        assert t['duration'] > 0
        assert Path(t['item_file']).name == t['item_file']
        assert t['item_file'].endswith('.json') and t['item_file'] not in filenames
        filenames.add(t['item_file'])
        item = {'format_version': 'beta', 'minecraft:item': {
            'description': {'identifier': ident, 'menu_category': {
                'category': 'items', 'group': 'minecraft:itemGroup.name.record'}},
            'components': {
                'minecraft:max_stack_size': 1,
                'minecraft:display_name': {'value': t['display_name']},
                'minecraft:rarity': 'rare',
                'minecraft:record': {k: t[k] for k in
                                     ('comparator_signal', 'duration', 'sound_event')},
                'minecraft:icon': {'textures': {'default': t['icon']}}
            }}}
        result[BP / 'items' / t['item_file']] = item
        atlas['texture_data'][t['icon']] = {'textures': t['texture']}
        definitions[event] = {'category': 'record', 'max_distance': 64.0,
                              'sounds': [{'name': t['sound'], 'stream': True,
                                          'volume': 0.5}]}
        # Optional full recipe document; existing releases have no CD recipes.
        if 'recipe' in t:
            recipe = t['recipe']
            body = recipe.get('minecraft:recipe_shaped', recipe.get('minecraft:recipe_shapeless'))
            assert body and body['result']['item'] == ident, 'Recipe must create its own CD'
            result[BP / 'recipes' / (ident.split(':')[1] + '.json')] = t['recipe']
    result[RP / 'textures/item_texture.json'] = atlas
    result[RP / 'sounds/sound_definitions.json'] = {
        'format_version': '1.14.0', 'sound_definitions': definitions}
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only drift check')
    args = parser.parse_args()
    pending = [(p, d) for p, d in outputs().items()
               if not p.exists() or load(p) != d]
    if args.check:
        for p, _ in pending:
            print('OUT OF DATE:', p.relative_to(ROOT))
        if pending:
            raise SystemExit(1)
    else:
        for p, d in pending:
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(f'PineCD build: {len(pending)} differing files')


if __name__ == '__main__':
    main()
