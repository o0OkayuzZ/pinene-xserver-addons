"""Regression checks for Alylica/Waystone localization and custom-font glyphs."""
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[2]
DUNGEONS_BP = next(ROOT.glob("behavior_packs/bp_08_*"))
DUNGEONS_RP = next(ROOT.glob("resource_packs/rp_06_*"))
WAYSTONE_BP = next(ROOT.glob("behavior_packs/bp_11_*"))
WAYSTONE_RP = next(ROOT.glob("resource_packs/rp_12_*"))


def lang(path):
    result = {}
    for raw in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw.lstrip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        result[key] = value
    return result


def png_size(path):
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise AssertionError(f"not a PNG: {path}")
    return struct.unpack(">II", data[16:24])


class I18nGlyphRegression(unittest.TestCase):
    def test_dungeons_japanese_covers_english_keys(self):
        en = lang(DUNGEONS_RP / "texts/en_US.lang")
        ja = lang(DUNGEONS_RP / "texts/ja_JP.lang")
        self.assertFalse(set(en) - set(ja))
        text = (DUNGEONS_RP / "texts/ja_JP.lang").read_text(encoding="utf-8-sig")
        self.assertNotIn("\ufffd", text)

    def test_ancient_hunt_screenshot_strings_are_localized(self):
        ja = lang(DUNGEONS_RP / "texts/ja_JP.lang")
        expected = {
            "dungeons.dimension.grand_bastion": "§g大要塞",
            "entity.dungeons:unstoppable_tusk.name": "§g止められぬ牙§f",
            "dungeons.boa.ancient": "古代ボス:",
            "dungeons.boa.ancient_loot_table": "入手可能な金メッキ装備:",
        }
        for key, value in expected.items():
            self.assertEqual(ja[key], value)
        self.assertIn("崩れかけた複雑な迷宮", ja["dungeons.dimension.description.grand_bastion"])

    def test_dungeons_rune_font_page_and_codepoints_exist(self):
        glyph = DUNGEONS_RP / "font/glyph_E9.png"
        self.assertTrue(glyph.is_file())
        self.assertEqual(png_size(glyph), (256, 256))
        expected = [f"\\uE90{i}" for i in range(1, 10)]
        for script in [
            DUNGEONS_BP / "scripts/components/other/bookAncients.js",
            DUNGEONS_BP / "scripts/components/other/theBookOfHeroes.js",
        ]:
            text = script.read_text(encoding="utf-8")
            for codepoint in expected:
                self.assertIn(codepoint, text, f"{script}: {codepoint}")

    def test_waystone_xp_font_page_and_codepoints_exist(self):
        glyph = WAYSTONE_RP / "font/glyph_E7.png"
        self.assertTrue(glyph.is_file())
        self.assertEqual(png_size(glyph), (256, 256))
        text = (WAYSTONE_BP / "scripts/simple_waystone/ui/listUI.js").read_text(encoding="utf-8")
        for codepoint in ["\\ue700", "\\ue701", "\\ue702", "\\ue703"]:
            self.assertIn(codepoint, text)


if __name__ == "__main__":
    unittest.main()
