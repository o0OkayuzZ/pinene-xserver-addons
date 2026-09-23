"""Strict ice-box contract and recursive 27-stack bound; no Bedrock engine emulation."""
from __future__ import annotations
import argparse
import copy
import hashlib
import json
import math
import random
from collections import Counter
from fractions import Fraction
from pathlib import Path
from build_bsl_icebox_jackpot import ROOT, TABLE, build, find_pack, load

ENCHANTED = {"a:egbread", "pinene:enchanted_golden_carrot",
    "pinene:enchanted_baked_golden_potato", "pinene:enchanted_golden_beetroot",
    "pinene:enchanted_glistering_melon_slice", "pinene:enchanted_golden_pumpkin_pie",
    "pinene:enchanted_golden_poisonous_potato"}
GOLDEN = {"a:gbread", "pinene:golden_potato", "pinene:baked_golden_potato",
    "pinene:golden_beetroot", "pinene:golden_pumpkin_pie", "pinene:golden_poisonous_potato"}
PANCAKES = {"myname:pancake", "pinebento:honey_pancake", "pinebento:berry_honey_pancake"}
APPLE = "minecraft:enchanted_golden_apple"
RARES = (("loot_tables/bsl/collectibles/all.json", Fraction(3, 10)),
         ("ws:warpstone", Fraction(1, 25)), ("resetapple:blue_apple", Fraction(3, 250)))
RESOURCES = {"minecraft:diamond", "minecraft:emerald", "minecraft:gold_block", "minecraft:experience_bottle"}
ROLES = ("enchanted_food", "golden_food", "enchanted_apple", "pancakes",
         "collectible_or_resource", "warpstone_or_resource", "blue_apple_or_resource", "packed_ice", "snowballs")
VANILLA_LIMITS = {APPLE: 64, "minecraft:packed_ice": 64, "minecraft:snowball": 16,
                  **{name: 64 for name in RESOURCES}}


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def definitions(root: Path = ROOT) -> dict:
    active = {row["pack_id"] for row in load(root / "world_behavior_packs.json")}
    result = {}
    packs = [p.parent for p in (root / "behavior_packs").glob("*/manifest.json")
             if load(p)["header"]["uuid"] in active]
    # An explicit item can intentionally accompany a placeable block with the
    # same ID. Read item stack limits first; block-only items are fallbacks.
    for folder, key in [("items", "minecraft:item"), ("blocks", "minecraft:block")]:
        for pack in packs:
            for path in (pack / folder).rglob("*.json"):
                data = load(path).get(key, {})
                name = data.get("description", {}).get("identifier")
                if not name or (folder == "blocks" and name in result):
                    continue
                result.setdefault(name, []).append(data.get("components", {}))
    return result


def limits(entry: dict, registry: dict) -> tuple[int, int]:
    require(set(entry) <= {"type", "name", "weight", "functions"}, "Unexpected item metadata/conditions")
    name = entry["name"]
    if name in VANILLA_LIMITS:
        maximum = VANILLA_LIMITS[name]
    else:
        require(len(registry.get(name, [])) == 1, f"Missing or ambiguous active item: {name}")
        maximum = registry[name][0].get("minecraft:max_stack_size", 64)
        if isinstance(maximum, dict):
            maximum = maximum["value"]
    require(type(maximum) is int and maximum >= 1, f"Invalid max stack size: {name}")
    functions = entry.get("functions", [])
    require(len(functions) <= 1, f"Multiple quantity functions: {name}")
    count = 1
    if functions:
        require(set(functions[0]) == {"function", "count"} and functions[0]["function"] == "set_count",
                f"Unsupported or conditional item function: {name}")
        count = functions[0]["count"]
    if type(count) is int:
        low = high = count
    else:
        require(isinstance(count, dict) and set(count) == {"min", "max"}, f"Unknown count provider: {name}")
        low, high = count["min"], count["max"]
    require(type(low) is int and type(high) is int and 1 <= low <= high <= maximum,
            f"Stack overflow or empty output: {name}: {low}..{high}, max={maximum}")
    return low, high


def inspect_graph(table: dict, pack: Path, registry: dict, chain: tuple = ()) -> tuple[int, int]:
    require(set(table) == {"pools"} and bool(table["pools"]), "Unexpected table properties")
    minimum = maximum = 0
    for pool in table["pools"]:
        require(set(pool) == {"rolls", "entries"}, "Conditional/bonus rolls are not capacity safe")
        rolls = pool["rolls"]
        require(type(rolls) is int and rolls > 0, "All ice-box draw counts must be fixed positive integers")
        require(bool(pool["entries"]), "Empty reward pool")
        bounds = []
        for entry in pool["entries"]:
            weight = entry.get("weight", 1)
            require(type(weight) is int and weight > 0, "Non-positive/invalid loot weight")
            if entry.get("type") == "item":
                limits(entry, registry)
                bounds.append((1, 1))
            elif entry.get("type") == "loot_table":
                require(set(entry) <= {"type", "name", "weight"}, "Unexpected nested entry metadata")
                name = entry["name"]
                require(name.startswith("loot_tables/") and ".." not in Path(name).parts,
                        "Invalid reference path")
                require(name not in chain, f"Reference cycle: {name}")
                target = pack / name
                require(target.is_file(), f"Missing nested table: {name}")
                bounds.append(inspect_graph(load(target), pack, registry, (*chain, name)))
            else:
                raise ValueError("Every branch must emit an item, not empty/unknown entry")
        minimum += rolls * min(low for low, _ in bounds)
        maximum += rolls * max(high for _, high in bounds)
    return minimum, maximum


def validate(table: dict | None = None, *, pack: Path | None = None,
             registry: dict | None = None, compare_generator: bool = True) -> dict:
    pack = find_pack() if pack is None else pack
    table = load(pack / TABLE) if table is None else table
    registry = definitions() if registry is None else registry
    bounds = inspect_graph(table, pack, registry)
    require(bounds == (27, 27), f"Expected exactly 27 generated stacks in every branch, got {bounds}")
    pools = table["pools"]
    require([p["rolls"] for p in pools] == [16, 3, 1, 2, 1, 1, 1, 1, 1], "Approved allocation changed")
    for index, names, amount in [(0, ENCHANTED, (3, 6)), (1, GOLDEN, (4, 8)), (3, PANCAKES, (2, 4))]:
        entries = pools[index]["entries"]
        require({e["name"] for e in entries} == names and len(entries) == len(names), "Food roster changed")
        for entry in entries:
            require("minecraft:food" in registry[entry["name"]][0], "Ingredients cannot occupy an edible-food slot")
            require(limits(entry, registry) == amount, "Approved food stack quantity changed")
    for index, name, amount in [(2, APPLE, (2, 4)), (7, "minecraft:packed_ice", (8, 16)), (8, "minecraft:snowball", (8, 16))]:
        entries = pools[index]["entries"]
        require(len(entries) == 1 and entries[0]["name"] == name and limits(entries[0], registry) == amount,
                "Guaranteed reward or cold-theme allocation changed")
    for index, (name, chance) in enumerate(RARES, start=4):
        entries = pools[index]["entries"]
        require(len(entries) == 5 and {e["name"] for e in entries} == RESOURCES | {name}, "Invalid replacement roster")
        selected = next(e for e in entries if e["name"] == name)
        require(Fraction(selected.get("weight", 1), sum(e.get("weight", 1) for e in entries)) == chance,
                f"Rare probability changed: {name}")
    if compare_generator:
        require(table == build(pack), "Generated ice-box artifact is stale or manually edited")
    return {"status": "PASS", "generatedStacks": list(bounds), "enchantedFoodQuantity": [48, 96],
            "goldenFoodQuantity": [12, 24], "enchantedGoldenAppleQuantity": [2, 4],
            "rareReplacementProbabilities": {n: float(p) for n, p in RARES},
            "engineVerified": False, "nativeOccupiedSlots": "Not asserted; requires Bedrock verification"}


def simulate(trials: int = 10000, seed: int = 20260923) -> dict:
    require(trials >= 1000, "Use at least 1000 trials")
    pack, registry, rng = find_pack(), definitions(), random.Random(seed)
    table = load(pack / TABLE)
    report = validate(table, pack=pack, registry=registry)
    cache = {}
    def sample(data: dict, group: str) -> list:
        results = []
        for pool in data["pools"]:
            entries = pool["entries"]
            total = sum(e.get("weight", 1) for e in entries)
            for _ in range(pool["rolls"]):
                draw = rng.randrange(total)
                for entry in entries:
                    draw -= entry.get("weight", 1)
                    if draw < 0:
                        break
                if entry["type"] == "item":
                    low, high = limits(entry, registry)
                    results.append({"item": entry["name"], "count": rng.randint(low, high), "group": group})
                else:
                    target = entry["name"]
                    if target not in cache:
                        cache[target] = load(pack / target)
                    results.extend(sample(cache[target], group))
        return results
    quantities, unique_counts, golden = [], [], []
    rare_hits = Counter()
    examples = []
    for index in range(trials):
        rows = []
        for role, pool in zip(ROLES, table["pools"]):
            rows.extend(sample({"pools": [pool]}, role))
        require(len(rows) == 27, "Simulation exceeded the approved stack count")
        enchanted = [r for r in rows if r["group"] == ROLES[0]]
        quantity = sum(r["count"] for r in enchanted)
        golden_count = sum(r["count"] for r in rows if r["group"] == ROLES[1])
        require(len(enchanted) == 16 and 48 <= quantity <= 96, "Lost enchanted food")
        require(12 <= golden_count <= 24 and sum(r["count"] for r in rows if r["item"] == APPLE) in (2, 3, 4),
                "Missing premium food or guaranteed apples")
        quantities.append(quantity)
        golden.append(golden_count)
        unique_counts.append(len({r["item"] for r in enchanted}))
        for slot, (name, _) in enumerate(RARES, start=4):
            row = next(r for r in rows if r["group"] == ROLES[slot])
            if row["item"] not in RESOURCES:
                rare_hits[name] += 1
        if index < 3:
            display = copy.deepcopy(rows)
            rng.shuffle(display)
            examples.append(display)
    frequencies = {}
    for name, chance in RARES:
        probability = float(chance)
        actual = rare_hits[name] / trials
        require(abs(actual - probability) <= 6 * math.sqrt(probability * (1 - probability) / trials) + 1 / trials,
                f"Rare frequency outside six-sigma tolerance: {name}")
        frequencies[name] = {"expected": probability, "observed": actual, "hits": rare_hits[name]}
    report.update({"trials": trials, "seed": seed,
        "enchantedFood": {"mean": sum(quantities) / trials, "observedMin": min(quantities), "observedMax": max(quantities),
                          "theoreticalMin": 48, "theoreticalMax": 96, "theoreticalMean": 72,
                          "meanUniqueEdibleTypes": sum(unique_counts) / trials},
        "goldenFoodMean": sum(golden) / trials, "rareFrequencies": frequencies,
        "capacityFailures": 0, "examplesAreSimulated": True, "examples": examples,
        "tableSHA256": hashlib.sha256(json.dumps(table, sort_keys=True).encode()).hexdigest()})
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--trials", type=int, default=10000)
    parser.add_argument("--report", type=Path)
    args = parser.parse_args()
    result = simulate(args.trials)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_bytes((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
    print(json.dumps({k: v for k, v in result.items() if k != "examples"}, ensure_ascii=False, indent=2))
