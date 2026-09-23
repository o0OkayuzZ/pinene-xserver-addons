import json
import struct
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
BP = ROOT / "behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639"
RP = ROOT / "resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a"

CASES = {
    "auto_defense": ("pinene_gf:case_auto_defense", "pinene_gf_case_auto_defense", "自動防御カードケース"),
    "auto_attack": ("pinene_gf:case_auto_attack", "pinene_gf_case_auto_attack", "自動攻撃カードケース"),
    "active_defense": ("pinene_gf:case_active_defense", "pinene_gf_case_active_defense", "能動防御カードケース"),
    "active_attack": ("pinene_gf:case_active_attack", "pinene_gf_case_active_attack", "能動攻撃カードケース"),
}

def png_size(path):
    b = path.read_bytes()
    if b[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(path)
    return struct.unpack(">II", b[16:24])

class GFCardCaseTests(unittest.TestCase):
    def test_case_assets_and_items(self):
        atlas = json.loads((RP / "textures/item_texture.json").read_text(encoding="utf-8-sig"))
        for slug, (identifier, texture_key, display_name) in CASES.items():
            self.assertEqual(png_size(RP / f"textures/items/gf/cases/case_{slug}.png"), (32, 32))
            self.assertEqual(atlas["texture_data"][texture_key]["textures"], f"textures/items/gf/cases/case_{slug}")
            item = json.loads((BP / f"items/gf/cases/case_{slug}.json").read_text(encoding="utf-8"))
            root = item["minecraft:item"]
            self.assertEqual(root["description"]["identifier"], identifier)
            self.assertEqual(root["components"]["minecraft:icon"]["textures"]["default"], texture_key)
            self.assertEqual(root["components"]["minecraft:display_name"]["value"], display_name)
            self.assertEqual(root["components"]["minecraft:max_stack_size"], 1)

if __name__ == "__main__":
    unittest.main()
