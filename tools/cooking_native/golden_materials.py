"""Golden ingredients shared by the catalog generator and recipe compiler."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = Path('docs/cooking_ui/golden-ingredients.json')
MAX_DISH_RANK = 10


def load_golden_spec(root=ROOT):
    return json.loads((root / SPEC_PATH).read_text(encoding='utf-8-sig'))


def material_id(base_id, enchanted=False):
    return 'pine:' + ('enchanted_golden_' if enchanted else 'golden_') + base_id.split(':', 1)[1]


def golden_container_returns(spec=None):
    spec = load_golden_spec() if spec is None else spec
    returns = {}
    for material in spec['materials']:
        if material.get('container_return'):
            for enchanted in (False, True):
                returns[material_id(material['base_id'], enchanted)] = material['container_return']
    for item in spec['existing_ingredients']:
        if item.get('container_return'):
            returns[item['id']] = item['container_return']
    return returns


def ingredient_registry(spec=None):
    spec = load_golden_spec() if spec is None else spec
    result = {row['id']: dict(row) for row in spec['existing_ingredients']}
    for base in spec['materials']:
        for enchanted in (False, True):
            ident = material_id(base['base_id'], enchanted)
            result[ident] = {
                'id': ident,
                'base_id': base['base_id'],
                'name': ('エンチャントされた金の' if enchanted else '金の') + base['name'],
                'tier': 'enchanted_golden' if enchanted else 'golden',
                'container_return': base.get('container_return'),
                'source': 'pine_food',
            }
    assert len(result) == len(spec['existing_ingredients']) + 2 * len(spec['materials']), 'Duplicate golden ingredient ID'
    return result


def golden_recipe_rows(catalog, spec=None):
    spec = load_golden_spec() if spec is None else spec
    basics = {row['id']: row for row in catalog['materials']}
    result = []
    for base in spec['materials']:
        assert base['base_id'] in basics, 'Unknown base material: ' + base['base_id']
        original = basics[base['base_id']]
        icon = 'textures/items/golden_' + base['base_id'].split(':', 1)[1]
        for enchanted in (False, True):
            ident = material_id(base['base_id'], enchanted)
            name = ('エンチャントされた金の' if enchanted else '金の') + base['name']
            center = {
                'id': material_id(base['base_id']) if enchanted else base['base_id'],
                'count': 1,
                'name': '金の' + base['name'] if enchanted else base['name'],
                'icon': icon if enchanted else original['icon'],
            }
            coating = {
                'id': 'minecraft:gold_block' if enchanted else 'minecraft:gold_ingot',
                'count': 1,
                'name': '金ブロック' if enchanted else '金インゴット',
                'icon': 'textures/blocks/gold_block' if enchanted else 'textures/items/gold_ingot',
            }
            layout = [dict(coating) for _ in range(9)]
            layout[4] = dict(center)
            result.append({
                'id': ident, 'name': name, 'rank': 0,
                'description': f"作業台の中心に{center['name']}を置き、周囲8マスを{coating['name']}で囲む。上位料理用の素材。",
                'ingredients': [center, dict(coating, count=8)], 'layout': layout,
                'resultCount': 1, 'icon': icon, 'nutrition': None, 'saturation': None,
                'station': 'crafting_table', 'retains_container': True,
                'material_tier': 'enchanted_golden' if enchanted else 'golden',
            })
    return result


def material_item(row):
    slug = row['id'].split(':', 1)[1]
    return {
        'format_version': '1.21.90',
        'minecraft:item': {
            'description': {'identifier': row['id'], 'menu_category': {'category': 'items'}},
            'components': {
                'minecraft:icon': slug.removeprefix('enchanted_'),
                'minecraft:display_name': {'value': 'item.' + row['id'] + '.name'},
                'minecraft:max_stack_size': 64,
                'minecraft:glint': row['material_tier'] == 'enchanted_golden',
            },
        },
    }
