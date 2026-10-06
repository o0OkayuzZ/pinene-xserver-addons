"""Performance regressions for Alylica polling and Meshy food assets."""
from pathlib import Path
import json
import struct
import unittest

ROOT = Path(__file__).resolve().parents[2]
DUNGEONS = next(ROOT.glob("behavior_packs/bp_08_*"))
FOOD_RP = next(ROOT.glob("resource_packs/rp_21_*"))


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def png_size(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"not PNG: {path}")
    return struct.unpack(">II", data[16:24])


class PerformanceRegression(unittest.TestCase):
    def test_meshy_atlases_are_runtime_sized(self):
        texture_dir = FOOD_RP / "textures/models/meshy_food"
        textures = sorted(texture_dir.glob("*.png"))
        self.assertEqual(len(textures), 35)
        total_pixels = 0
        for texture in textures:
            width, height = png_size(texture)
            self.assertLessEqual(max(width, height), 512, texture.name)
            total_pixels += width * height
        self.assertLessEqual(total_pixels, 7_100_000)

    def test_meshy_geometry_uv_space_matches_resized_atlas(self):
        model_dir = FOOD_RP / "models/entity/meshy_food"
        for path in model_dir.glob("*.geo.json"):
            name = path.name.removesuffix(".geo.json")
            data = read_json(path)["minecraft:geometry"][0]
            desc = data["description"]
            width, height = png_size(FOOD_RP / f"textures/models/meshy_food/{name}.png")
            self.assertEqual((desc["texture_width"], desc["texture_height"]), (width, height))
            for bone in data.get("bones", []):
                for cube in bone.get("cubes", []):
                    uv = cube.get("uv")
                    if isinstance(uv, list):
                        self.assertGreaterEqual(uv[0], 0)
                        self.assertGreaterEqual(uv[1], 0)
                        self.assertLessEqual(uv[0], width)
                        self.assertLessEqual(uv[1], height)
                        continue
                    if not isinstance(uv, dict):
                        continue
                    for face in uv.values():
                        if not isinstance(face, dict) or "uv" not in face:
                            continue
                        u, v = face["uv"]
                        du, dv = face.get("uv_size", [0, 0])
                        self.assertGreaterEqual(min(u, u + du), -0.01, path.name)
                        self.assertGreaterEqual(min(v, v + dv), -0.01, path.name)
                        self.assertLessEqual(max(u, u + du), width + 0.01, path.name)
                        self.assertLessEqual(max(v, v + dv), height + 0.01, path.name)

    def test_duplicate_player_countdown_pollers_are_consolidated(self):
        main = (DUNGEONS / "scripts/main.js").read_text(encoding="utf-8")
        self.assertIn('import "./performance/playerCountdowns.js";', main)
        countdowns = (DUNGEONS / "scripts/performance/playerCountdowns.js").read_text(encoding="utf-8")
        objectives = [
            "glow_squid_armour_t", "squid_armour_t", "sweet_tooth_t", "tp_robes_t",
            "ember_robes_t", "final_shout_t", "shadow_blast_t", "hunting_bow_t",
            "poison_cloud_ranged_t", "echo_t", "gravity_t", "poison_cloud_t",
            "shockwave_t", "stun_t", "swirling_t", "void_strike_t",
            "battlestaff_sweep_t", "rapier_sweep_t",
        ]
        for objective in objectives:
            self.assertIn(f"dungeons:{objective}", countdowns)

    def test_quiver_cooldown_pollers_are_consolidated(self):
        main = (DUNGEONS / "scripts/main.js").read_text(encoding="utf-8")
        self.assertIn('import "./performance/quiverCooldownGuard.js";', main)
        folder = DUNGEONS / "scripts/components/artefacts"
        for name in [
            "fireworkQuiver.js", "flamingQuiver.js", "harpoonQuiver.js",
            "thunderingQuiver.js", "tormentQuiver.js", "voidQuiver.js",
        ]:
            text = (folder / name).read_text(encoding="utf-8")
            self.assertNotIn("const cooldownNames", text)


if __name__ == "__main__":
    unittest.main()
