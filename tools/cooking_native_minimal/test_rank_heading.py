"""Regression checks for native titles; these are not rendering tests."""
import json
import pathlib
import unittest
from compiler import LIMITS, TAG_PREFIX, table, compile_board

class RankHeadingTests(unittest.TestCase):
    def test_exact_titles_follow_knife_limits(self):
        expected = {'copper':'II','iron':'III','gold':'IV','diamond':'VI','netherite':'VII'}
        for material, numeral in expected.items():
            self.assertEqual(table(material)['table_name'], '料理  Rank ' + numeral)
    def test_empty_and_unknown_material_stay_locked(self):
        for material in ('empty', 'unknown', None):
            self.assertEqual(table(material), {'crafting_tags':['pinene_native_locked'], 'table_name':'料理'})
    def test_title_change_does_not_change_recipe_tags(self):
        for material, limit in LIMITS.items():
            self.assertEqual(table(material)['crafting_tags'], [TAG_PREFIX + str(r) for r in range(limit + 1)])
    def test_all_source_boards_receive_matching_titles(self):
        root = pathlib.Path(__file__).resolve().parents[2]
        paths = list((root/'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/blocks').glob('*_cutting_board.json'))
        self.assertEqual(len(paths), 13)
        for path in paths:
            compiled = compile_board(json.loads(path.read_text(encoding='utf-8-sig')))
            for material in LIMITS:
                condition = f"q.block_state('pinene_cooking:knife') == '{material}'"
                variant = next(p for p in compiled['minecraft:block']['permutations'] if p['condition'] == condition)
                self.assertEqual(variant['components']['minecraft:crafting_table'], table(material))
