"""Checks for client regressions exposed by the Dungeons 2.1.3 full-stack smoke test."""
import importlib.util
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ownership', ROOT / 'tools/audit_pack_ownership.py')
ownership = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ownership)
load = ownership.load_jsonc
RP = next(ROOT.glob('resource_packs/rp_06_*'))
BP = next(ROOT.glob('behavior_packs/bp_08_*'))


class DungeonsClientCompatibility(unittest.TestCase):
    def test_existing_ancient_outline_overlay_still_resolves(self):
        controllers = load(RP / 'render_controllers/custom_crossbow.rc.json')['render_controllers']
        name = 'controller.render.entity_ancient'
        desc = load(ROOT / 'resource_packs/pinenite_outline/entity/dungeons_cursed_presence.entity.json')['minecraft:client_entity']['description']
        self.assertIn(name, desc['render_controllers'])
        self.assertIn(name, controllers)
        for kind, alias in re.findall(r'\b(geometry|texture|material)\.([\w]+)', str(controllers[name])):
            table = {'geometry': 'geometry', 'texture': 'textures', 'material': 'materials'}[kind]
            self.assertIn(alias, desc[table])

    def test_legacy_crossbow_mesh_textures_resolve(self):
        legacy = next(ROOT.glob('resource_packs/rp_07_*'))
        meshes = []
        for path in (legacy / 'models').rglob('*.json'):
            for geometry in load(path).get('minecraft:geometry', []):
                if geometry['description']['identifier'] == 'geometry.crossbow_standby':
                    meshes.extend(mesh['texture'] for bone in geometry['bones'] for mesh in bone.get('texture_meshes', []))
        self.assertTrue(meshes)
        for path in (legacy / 'attachables').rglob('*.json'):
            desc = load(path)['minecraft:attachable']['description']
            if 'geometry.crossbow_standby' in desc.get('geometry', {}).values():
                for texture in meshes:
                    self.assertIn(texture, desc['textures'], str(path))

    def test_dungeons_crossbow_controller_does_not_override_legacy_crossbows(self):
        controllers = load(RP / 'render_controllers/custom_crossbow.rc.json')['render_controllers']
        self.assertNotIn('controller.render.custom_crossbow', controllers)
        name = 'controller.render.pinene.dungeons_213_crossbow'
        self.assertIn(name, controllers)
        expressions = str(controllers[name])
        aliases = re.findall(r'\b(geometry|texture|material)\.([\w]+)', expressions, re.I)
        checked = 0
        for path in (RP / 'attachables').rglob('*.json'):
            desc = load(path)['minecraft:attachable']['description']
            if name not in desc.get('render_controllers', []):
                continue
            checked += 1
            for kind, alias in aliases:
                table = {'geometry': 'geometry', 'texture': 'textures', 'material': 'materials'}[kind.lower()]
                self.assertIn(alias, desc.get(table, {}), f'{path}: {kind}.{alias}')
        self.assertGreater(checked, 0)

    def test_player_controller_does_not_require_new_spear_variable(self):
        text = (RP / 'animation_controllers/player/player.animation_controllers.json').read_text(encoding='utf-8')
        self.assertNotIn('variable.melee_spear_equipped', text)
        self.assertIn("query.equipped_item_any_tag('slot.weapon.mainhand', 'minecraft:is_spear')", text)

    def test_dungeons_catalog_items_and_icons_resolve(self):
        defined = set()
        for folder, kind in [('items', 'minecraft:item'), ('blocks', 'minecraft:block')]:
            for path in (BP / folder).rglob('*.json'):
                identifier = load(path).get(kind, {}).get('description', {}).get('identifier')
                if identifier:
                    defined.add(identifier)
        for path in ROOT.glob('behavior_packs/*/item_catalog/*.json'):
            for category in load(path)['minecraft:crafting_items_catalog']['categories']:
                for group in category['groups']:
                    for item in [group.get('group_identifier', {}).get('icon', ''), *group['items']]:
                        item = item if isinstance(item, str) else item['name']
                        if item.startswith('dungeons:'):
                            self.assertIn(item, defined, f'{path}: {item}')


if __name__ == '__main__':
    unittest.main()
