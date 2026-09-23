"""Regression tests for the approved ice-box allocation; no live world access."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from build_bsl_icebox_jackpot import build, find_pack, load, TABLE
from validate_bsl_icebox_jackpot import definitions, inspect_graph, validate


class IceBoxTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pack = find_pack()
        cls.table = load(cls.pack / TABLE)
        cls.registry = definitions()

    def check(self, table, registry=None):
        return validate(table, pack=self.pack, registry=self.registry if registry is None else registry,
                        compare_generator=False)

    def test_generated_artifact_and_approved_amounts(self):
        self.assertEqual(self.table, build(self.pack))
        result = self.check(self.table)
        self.assertEqual(result["generatedStacks"], [27, 27])
        self.assertEqual(result["enchantedFoodQuantity"], [48, 96])
        self.assertFalse(result["engineVerified"])

    def test_extra_roll_is_rejected(self):
        table = copy.deepcopy(self.table)
        table["pools"][0]["rolls"] += 1
        with self.assertRaisesRegex(ValueError, "exactly 27"):
            self.check(table)

    def test_empty_rare_fallback_is_rejected(self):
        table = copy.deepcopy(self.table)
        table["pools"][4]["entries"][-1] = {"type": "empty", "weight": 1}
        with self.assertRaisesRegex(ValueError, "not empty"):
            self.check(table)

    def test_snowball_overflow_is_rejected(self):
        table = copy.deepcopy(self.table)
        table["pools"][8]["entries"][0]["functions"][0]["count"]["max"] = 17
        with self.assertRaisesRegex(ValueError, "Stack overflow"):
            self.check(table)

    def test_rare_chance_drift_is_rejected(self):
        table = copy.deepcopy(self.table)
        table["pools"][4]["entries"][0]["weight"] += 1
        with self.assertRaisesRegex(ValueError, "probability changed"):
            self.check(table)

    def test_gold_apple_not_guaranteed_is_rejected(self):
        table = copy.deepcopy(self.table)
        table["pools"][2]["conditions"] = [{"condition": "random_chance", "chance": 0.75}]
        with self.assertRaisesRegex(ValueError, "capacity safe"):
            self.check(table)

    def test_custom_food_stack_limit_is_checked(self):
        registry = copy.deepcopy(self.registry)
        registry["a:egbread"][0]["minecraft:max_stack_size"] = 1
        with self.assertRaisesRegex(ValueError, "Stack overflow"):
            self.check(self.table, registry)

    def test_food_must_really_be_edible(self):
        registry = copy.deepcopy(self.registry)
        registry["a:egbread"][0].pop("minecraft:food")
        with self.assertRaisesRegex(ValueError, "edible-food"):
            self.check(self.table, registry)

    def test_hidden_nested_extra_stack_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "loot_tables/bsl/collectibles"
            folder.mkdir(parents=True)
            (folder / "all.json").write_text(json.dumps({"pools": [{"rolls": 2, "entries": [
                {"type": "item", "name": "minecraft:diamond"}]}]}), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "exactly 27"):
                validate(self.table, pack=root, registry=self.registry, compare_generator=False)

    def test_reference_cycle_is_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / "loot_tables"
            folder.mkdir()
            data = {"pools": [{"rolls": 1, "entries": [
                {"type": "loot_table", "name": "loot_tables/cycle.json"}]}]}
            (folder / "cycle.json").write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "Reference cycle"):
                inspect_graph(data, root, self.registry)

    def test_common_source_metadata_is_not_silently_discarded(self):
        altered = {"pools": [{"rolls": 1, "entries": [{"type": "item", "name": "a:egbread",
                    "conditions": [{"condition": "random_chance", "chance": 0.5}]}]}]}
        with patch("build_bsl_icebox_jackpot.load", return_value=altered):
            with self.assertRaisesRegex(ValueError, "Review changed metadata"):
                build(self.pack)


if __name__ == "__main__":
    unittest.main(verbosity=2)
