#!/usr/bin/env python3
"""
Rebuild normal Better Structure Loot chest tables into weighted multi-draw tables.

Design:
- Profile draw counts:
    Early 13-17
    Mid   14-18
    High  14-19
    End   15-20
- Special tables are untouched:
    ancient_city_ice_box.json
    bastion_treasure.json
    buriedtreasure.json
- Ordinary pools are flattened by their *old expected non-empty draw contribution*.
- Existing entry weights are preserved inside each old pool.
- set_count quantities are reduced to ceil(old / 4), minimum 1.
- Independent rare/progression pools described by docs/bsl/provenance.json remain
  independent and keep their current probabilities/semantics.
- Unsupported conditional pools are preserved rather than guessed at.

Run from repository root:
    python tools/build_bsl_weighted_rebalance.py
    python tools/build_bsl_weighted_rebalance.py --write

The dry run writes only an audit preview to stdout. --write replaces the 33
non-Special BSL chest JSON files and writes docs/bsl/weighted-rebalance-v2.json.
"""
from __future__ import annotations

import argparse
import copy
import json
import math
import subprocess
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
BP = ROOT / "behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12"
CHESTS = BP / "loot_tables/chests"
PROVENANCE = ROOT / "docs/bsl/provenance.json"
AUDIT = ROOT / "docs/bsl/weighted-rebalance-v2.json"
BASELINE = "c60934c0"

PROFILE_ROLLS = {
    "Early": {"min": 13, "max": 17},
    "Mid": {"min": 14, "max": 18},
    "High": {"min": 14, "max": 19},
    "End": {"min": 15, "max": 20},
}

SPECIAL = {
    "ancient_city_ice_box.json",
    "bastion_treasure.json",
    "buriedtreasure.json",
}

WEIGHT_SCALE = 100_000


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def expected_rolls(pool: dict[str, Any]) -> float:
    rolls = pool.get("rolls", 1)
    if isinstance(rolls, dict):
        value = (float(rolls["min"]) + float(rolls["max"])) / 2.0
    else:
        value = float(rolls)

    for condition in pool.get("conditions", []):
        kind = condition.get("condition")
        if kind == "random_chance":
            value *= float(condition["chance"])
        else:
            raise ValueError(f"unsupported pool condition {kind!r}")
    return value


def entry_weight(entry: dict[str, Any]) -> float:
    return float(entry.get("weight", 1))


def entry_name(entry: dict[str, Any]) -> str | None:
    return entry.get("name")


def is_empty(entry: dict[str, Any]) -> bool:
    return entry.get("type") == "empty"


def pool_is_independent(pool: dict[str, Any], independent_names: set[str]) -> bool:
    """
    Preserve a pool when every non-empty direct entry is explicitly listed as an
    independent reward for the chest in provenance.json.

    This handles both:
      - one-entry chance pools (food / collectible / warpstone / blue apple)
      - combined rare pools with empty + multiple rare entries (e.g. trims)
    """
    entries = pool.get("entries", [])
    nonempty = [entry for entry in entries if not is_empty(entry)]
    if not nonempty:
        return False
    names = [entry_name(entry) for entry in nonempty]
    return all(name is not None and name in independent_names for name in names)


def quarter_value(value: float | int) -> int:
    return max(1, int(math.ceil(float(value) / 4.0)))


def quarter_functions(functions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = copy.deepcopy(functions)
    for fn in result:
        if fn.get("function") != "set_count" or "count" not in fn:
            continue
        count = fn["count"]
        if isinstance(count, dict):
            if "min" in count:
                count["min"] = quarter_value(count["min"])
            if "max" in count:
                count["max"] = quarter_value(count["max"])
            if "min" in count and "max" in count and count["min"] > count["max"]:
                count["max"] = count["min"]
        else:
            fn["count"] = quarter_value(count)
    return result


def quarter_entry(entry: dict[str, Any]) -> dict[str, Any]:
    out = copy.deepcopy(entry)
    if "functions" in out:
        out["functions"] = quarter_functions(out["functions"])
    return out


def pool_contributions(pool: dict[str, Any]) -> list[tuple[dict[str, Any], float]]:
    """
    Return (entry, old expected non-empty draws of that entry).

    Empty weight is folded into the category's expected contribution and then
    removed, so the flattened pool targets occupied-looking draws without
    pretending old empty hits had value.
    """
    if pool.get("functions"):
        raise ValueError("pool functions require retaining the original pool")
    entries = pool.get("entries", [])
    if any(e.get("conditions") for e in entries):
        raise ValueError("conditional entries require retaining the original pool")
    nonempty = [entry for entry in entries if not is_empty(entry)]
    if not nonempty:
        return []

    all_weight = sum(entry_weight(e) for e in entries)
    nonempty_weight = sum(entry_weight(e) for e in nonempty)
    if all_weight <= 0 or nonempty_weight <= 0:
        return []

    draws = expected_rolls(pool)
    expected_nonempty = draws * (nonempty_weight / all_weight)

    result: list[tuple[dict[str, Any], float]] = []
    for entry in nonempty:
        contribution = expected_nonempty * entry_weight(entry) / nonempty_weight
        result.append((quarter_entry(entry), contribution))
    return result


def build_table(
    source: dict[str, Any],
    profile: str,
    independent_names: set[str],
) -> tuple[dict[str, Any], dict[str, Any]]:
    flattened: list[tuple[dict[str, Any], float]] = []
    preserved: list[dict[str, Any]] = []
    preserved_reasons: list[str] = []

    for index, pool in enumerate(source.get("pools", [])):
        if pool_is_independent(pool, independent_names):
            preserved.append(copy.deepcopy(pool))
            preserved_reasons.append(f"pool {index}: independent")
            continue

        try:
            flattened.extend(pool_contributions(pool))
        except ValueError as exc:
            # Safer than silently changing conditional semantics.
            preserved.append(copy.deepcopy(pool))
            preserved_reasons.append(f"pool {index}: preserved ({exc})")

    if not flattened:
        raise ValueError(f"{profile}: no ordinary pool entries were flattenable")

    total = sum(contribution for _, contribution in flattened)
    if total <= 0:
        raise ValueError(f"{profile}: flattened contribution total is zero")

    entries: list[dict[str, Any]] = []
    for entry, contribution in flattened:
        out = copy.deepcopy(entry)
        out["weight"] = max(1, round((contribution / total) * WEIGHT_SCALE))
        entries.append(out)

    base_pool = {
        "rolls": copy.deepcopy(PROFILE_ROLLS[profile]),
        "entries": entries,
    }
    result = {"pools": [base_pool, *preserved]}

    audit = {
        "profile": profile,
        "newBaseRolls": PROFILE_ROLLS[profile],
        "ordinaryEntryCount": len(entries),
        "preservedPoolCount": len(preserved),
        "preservedPools": preserved_reasons,
        "normalizedWeightTotal": sum(int(e["weight"]) for e in entries),
    }
    return result, audit


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="replace loot tables on disk")
    args = parser.parse_args()

    provenance = load_json(PROVENANCE)
    profiles = provenance["profiles"]

    audits: dict[str, Any] = {
        "schema": 1,
        "baseline": BASELINE,
        "profileRolls": PROFILE_ROLLS,
        "specialUntouched": sorted(SPECIAL),
        "tables": {},
    }

    changed: dict[Path, dict[str, Any]] = {}

    for relative_name, profile_info in sorted(profiles.items()):
        filename = Path(relative_name).name
        profile = profile_info["profile"]

        if profile == "Special":
            if filename not in SPECIAL:
                raise ValueError(f"unexpected Special table: {relative_name}")
            audits["tables"][relative_name] = {"profile": profile, "status": "untouched"}
            continue

        if profile not in PROFILE_ROLLS:
            raise ValueError(f"unknown profile {profile!r} for {relative_name}")

        path = CHESTS / relative_name
        if not path.exists():
            raise FileNotFoundError(path)

        # Always transform the original release, never quarter already-rebalanced
        # quantities again. Reject unknown edits instead of overwriting them.
        source = json.loads(subprocess.check_output(
            ["git", "show", BASELINE + ":" + path.relative_to(ROOT).as_posix()], cwd=ROOT
        ))
        independent_names = set(profile_info.get("independentChances", {}).keys())

        # waystone:waystone was removed later; keeping its old provenance key is harmless.
        rebuilt, audit = build_table(source, profile, independent_names)
        current = load_json(path)
        # v3 may carry reviewed structure-identity additions in the weighted pool.
        # Do not overwrite those by running the historical rebuilder.
        if current not in (source, rebuilt):
            raise ValueError(f"v3 reviewed edits in {relative_name}; builder is audit-only until identity additions are encoded")
        changed[path] = rebuilt
        audits["tables"][relative_name] = {"status": "rebuilt", **audit}

    special_profiles = {
        Path(name).name
        for name, info in profiles.items()
        if info["profile"] == "Special"
    }
    if special_profiles != SPECIAL:
        raise ValueError(
            f"Special set mismatch: provenance={sorted(special_profiles)} expected={sorted(SPECIAL)}"
        )

    summary = {
        "rebuilt": len(changed),
        "specialUntouched": len(SPECIAL),
        "profiles": {
            profile: sum(
                1
                for info in profiles.values()
                if info["profile"] == profile
            )
            for profile in [*PROFILE_ROLLS, "Special"]
        },
    }
    audits["summary"] = summary

    if args.write:
        for path, data in changed.items():
            path.write_bytes((json.dumps(data, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        AUDIT.parent.mkdir(parents=True, exist_ok=True)
        AUDIT.write_bytes((json.dumps(audits, ensure_ascii=False, indent=2) + "\n").encode("utf-8"))
        print(f"Wrote {len(changed)} normal BSL tables; kept {len(SPECIAL)} Special tables unchanged.")
        print(f"Audit: {AUDIT.relative_to(ROOT)}")
    else:
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        print("Dry run only. Re-run with --write to replace tables.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
