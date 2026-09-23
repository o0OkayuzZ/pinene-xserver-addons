"""Build only the approved ice-box jackpot; never alter common food tables.

Dry run/check: python -B tools/build_bsl_icebox_jackpot.py
Write:         python -B tools/build_bsl_icebox_jackpot.py --write
27 generated stacks is a capacity bound, not a claim about native slot layout.
"""
from __future__ import annotations
import argparse
import copy
import json
from fractions import Fraction
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
PACK_UUID = "423276b9-02f5-4082-911a-c631a2d83d12"
TABLE = "loot_tables/chests/ancient_city_ice_box.json"
SOURCE_NAMES = ("enchanted_golden_foods", "golden_foods", "pancakes")


def load(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def find_pack(root: Path = ROOT) -> Path:
    matches = [p.parent for p in (root / "behavior_packs").glob("*/manifest.json")
               if load(p).get("header", {}).get("uuid") == PACK_UUID]
    if len(matches) != 1:
        raise ValueError(f"Expected exactly one BSL pack, found {len(matches)}")
    return matches[0]


def item(name: str, low: int, high: int, weight: int = 1) -> dict:
    return {"type": "item", "name": name, "weight": weight,
            "functions": [{"function": "set_count", "count": {"min": low, "max": high}}]}


def food_entries(pack: Path, source: str, low: int, high: int) -> list[dict]:
    table = load(pack / f"loot_tables/bsl/food/{source}.json")
    pools = table.get("pools", [])
    if len(pools) != 1 or set(pools[0]) != {"rolls", "entries"} or pools[0]["rolls"] != 1:
        raise ValueError(f"Source {source} no longer emits one unconditional item")
    result = []
    for entry in pools[0]["entries"]:
        if entry.get("type") != "item" or set(entry) - {"type", "name", "weight"}:
            raise ValueError(f"Review changed metadata in {source}: {entry}")
        # Ingredients are not edible jackpot rewards; keep them in shared tables.
        if entry["name"] in {"a:egwheat", "a:gwheat"}:
            continue
        weight = entry.get("weight", 1)
        if type(weight) is not int or weight <= 0:
            raise ValueError(f"Invalid source weight in {source}")
        result.append(item(entry["name"], low, high, weight))
    if not result:
        raise ValueError(f"Empty food source: {source}")
    return result


def resource_entries() -> list[dict]:
    return [item("minecraft:diamond", 8, 20, 10),
            item("minecraft:emerald", 8, 20, 10),
            item("minecraft:gold_block", 2, 6, 8),
            item("minecraft:experience_bottle", 12, 32, 8)]


def replacement(rare: dict, chance: Fraction) -> dict:
    """One occupied reward, either the rare hit OR resources; never an extra draw."""
    if not 0 < chance < 1:
        raise ValueError("Replacement chance must be between zero and one")
    ordinary = resource_entries()
    rare = copy.deepcopy(rare)
    rare["weight"] = sum(e["weight"] for e in ordinary) * chance.numerator
    for entry in ordinary:
        entry["weight"] *= chance.denominator - chance.numerator
    return {"rolls": 1, "entries": [rare, *ordinary]}


def build(pack: Path | None = None) -> dict:
    pack = find_pack() if pack is None else pack
    pools = [
        {"rolls": 16, "entries": food_entries(pack, SOURCE_NAMES[0], 3, 6)},
        {"rolls": 3, "entries": food_entries(pack, SOURCE_NAMES[1], 4, 8)},
        {"rolls": 1, "entries": [item("minecraft:enchanted_golden_apple", 2, 4)]},
        {"rolls": 2, "entries": food_entries(pack, SOURCE_NAMES[2], 2, 4)},
        replacement({"type": "loot_table", "name": "loot_tables/bsl/collectibles/all.json"}, Fraction(3, 10)),
        replacement({"type": "item", "name": "ws:warpstone"}, Fraction(1, 25)),
        replacement({"type": "item", "name": "resetapple:blue_apple"}, Fraction(3, 250)),
        {"rolls": 1, "entries": [item("minecraft:packed_ice", 8, 16)]},
        {"rolls": 1, "entries": [item("minecraft:snowball", 8, 16)]},
    ]
    if sum(p["rolls"] for p in pools) != 27:
        raise ValueError("Approved reward allocation must total 27")
    return {"pools": pools}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    pack = find_pack()
    expected = build(pack)
    path = pack / TABLE
    if args.write:
        path.write_bytes((json.dumps(expected, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        print(f"Wrote {path.relative_to(ROOT)} (27 reward stacks)")
        return 0
    if load(path) != expected:
        print("DIFF: ice-box table differs from the approved generator")
        return 1
    print("PASS: ice-box table matches generator; shared loot tables are read-only")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
