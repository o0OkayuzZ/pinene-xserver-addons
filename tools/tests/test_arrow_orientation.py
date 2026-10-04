"""Projectile rendering must not replace vanilla arrow orientation globally."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('ownership', ROOT / 'tools/audit_pack_ownership.py')
ownership = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ownership)
load = ownership.load_jsonc


class ArrowOrientationTests(unittest.TestCase):
    def test_no_pack_overrides_vanilla_arrow_animation(self):
        for path in ROOT.glob('resource_packs/*/animations/**/*.json'):
            self.assertNotIn('animation.arrow.move', load(path).get('animations', {}), str(path))

    def test_shingan_uses_isolated_pitch_and_yaw(self):
        rp = next(ROOT.glob('resource_packs/rp_20_*'))
        name = 'animation.pinene_pvp.shingan_arrow.move'
        animation = load(rp / 'animations/arrow.move.json')['animations'][name]
        self.assertEqual(animation['bones']['body']['rotation'],
                         ['-query.target_x_rotation', '-query.target_y_rotation', 0])
        for path in (rp / 'entity').glob('*shingan_arrow.entity.json'):
            desc = load(path)['minecraft:client_entity']['description']
            self.assertEqual(desc['animations']['move'], name)
            controller = desc['render_controllers'][0]
            self.assertNotEqual(controller, 'controller.render.arrow')
            self.assertIn(controller, load(rp / 'render_controllers/arrow.render_controllers.json')['render_controllers'])

    def test_crossbow_all_arrow_bones_follow_projectile_target(self):
        rp = next(ROOT.glob('resource_packs/rp_07_*'))
        animation = load(rp / 'animations/arrow_target_rotation.json')['animations']['animation.arrow.target_rotation']
        for bone in animation['bones'].values():
            self.assertEqual(bone['rotation']['0.0'],
                             ['-query.target_x_rotation', '-query.target_y_rotation', 0])
        consumers = [load(p)['minecraft:client_entity']['description'] for p in (rp / 'entity').glob('*.json')]
        ids = {d['identifier'] for d in consumers if d.get('animations', {}).get('move') == 'animation.arrow.target_rotation'}
        self.assertTrue({'pinene:sniper_bolt_projectile', 'pinene:bomb_bolt_projectile', 'sysc:arrow_tnt'}.issubset(ids))


if __name__ == '__main__':
    unittest.main()
