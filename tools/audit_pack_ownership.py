"""Audit active Bedrock packs for ownership drift and accidental duplicate payloads."""
from __future__ import annotations

import hashlib
import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BP_ROOT = ROOT / "behavior_packs"
RP_ROOT = ROOT / "resource_packs"

PINECD_BP = BP_ROOT / "bp_04_b29dadb1-6c0e-42f6-a56e-f52e01dff8e9"
PINECD_RP = RP_ROOT / "rp_01_1497b511-a764-46d4-b726-dd0f5c5d7784"
INTEGRATED_BP = BP_ROOT / "bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639"

FORBIDDEN_IN_INTEGRATED_BP = {
    "loot_tables/tcow.json",
    "spawn_rules/cow.json",
    "loot_tables/blocks/quartz_cluster.json",
    "loot_tables/blocks/quartz_crystal_block.json",
    "loot_tables/blocks/rose_quartz_cluster.json",
    "loot_tables/blocks/rose_quartz_crystal_block.json",
    "loot_tables/blocks/rose_quartz_large_bud.json",
    "loot_tables/blocks/deathnerite_block.json",
    "recipes/deathnerite_recipe/deathnerite_ingot.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_axe.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_boots.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_chestplate.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_helmet.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_leggings.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_pickaxe.json",
    "recipes/deathnerite_recipe/equipment/deathnerite_sword.json",
}

JUNK_RE = re.compile(
    r"(?:\.bak(?:_|\.|$)|/(?:_?backup)(?:/|_|$)|/old(?:/|_|$)|desktop\.ini$|thumbs\.db$)",
    re.IGNORECASE,
)
EDITOR_SOURCE_RE = re.compile(r"\\.(?:pdn|psd|xcf|blend|kra|zip|7z|rar|m4a|mp4|mov|wav|tmp|log)$", re.IGNORECASE)
TEXT_SUFFIXES = {".json", ".lang"}


def pack_dirs() -> list[Path]:
    result = []
    for root in (BP_ROOT, RP_ROOT):
        if not root.exists():
            continue
        for p in sorted(root.iterdir()):
            if p.is_dir() and (p / "manifest.json").is_file():
                result.append(p)
    return result


def files_for(pack: Path) -> list[Path]:
    return [p for p in pack.rglob("*") if p.is_file()]


def rel(path: Path) -> str:
    return path.relative_to(ROOT).as_posix()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def load_jsonc(path: Path):
    text = path.read_text(encoding="utf-8-sig")
    out: list[str] = []
    i = 0
    in_string = False
    escaped = False

    while i < len(text):
        ch = text[i]

        if in_string:
            out.append(ch)
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == '"':
                in_string = False
            i += 1
            continue

        if ch == '"':
            in_string = True
            out.append(ch)
            i += 1
            continue

        if ch == "/" and i + 1 < len(text) and text[i + 1] == "/":
            i += 2
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue

        if ch == "/" and i + 1 < len(text) and text[i + 1] == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                if text[i] in "\r\n":
                    out.append(text[i])
                i += 1
            i = min(i + 2, len(text))
            continue

        out.append(ch)
        i += 1

    cleaned = "".join(out)
    cleaned = re.sub(r",\s*([}\]])", r"\1", cleaned)
    return json.loads(cleaned)


def main() -> None:
    errors: list[str] = []
    packs = pack_dirs()
    all_files = [(pack, p) for pack in packs for p in files_for(pack)]

    # Do not ship editor/OS backups inside active packs.
    for _, path in all_files:
        if JUNK_RE.search("/" + rel(path)):
            errors.append(f"junk file in active pack: {rel(path)}")

    # PineCD has one item owner and one resource owner.
    for pack, path in all_files:
        low = rel(path).lower()
        if "pinecd" in low and pack not in (PINECD_BP, PINECD_RP):
            errors.append(f"PineCD file outside canonical packs: {rel(path)}")

        if path.name == "item_texture.json" and pack != PINECD_RP:
            data = load_json(path).get("texture_data", {})
            bad = sorted(k for k in data if k.startswith(("pinecd_", "pinecdpack_")))
            if bad:
                errors.append(f"PineCD atlas keys outside canonical RP: {rel(path)}: {bad[:5]}")

        if path.name == "sound_definitions.json" and pack != PINECD_RP:
            defs = load_jsonc(path).get("sound_definitions", {})
            bad = sorted(k for k in defs if k.startswith(("pinecd.", "pinecd:")))
            if bad:
                errors.append(f"PineCD sound events outside canonical RP: {rel(path)}: {bad[:5]}")

        if path.suffix == ".lang" and pack != PINECD_RP:
            lines = path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
            if any(line.startswith(("item.pinecd", "item.record.pinecd_")) for line in lines):
                errors.append(f"PineCD localization outside canonical RP: {rel(path)}")

        if path.suffix == ".json" and "items/" in low and pack != PINECD_BP:
            try:
                data = load_json(path)
            except (json.JSONDecodeError, UnicodeDecodeError):
                data = {}
            ident = data.get("minecraft:item", {}).get("description", {}).get("identifier")
            if isinstance(ident, str) and ident.startswith("pinecd:"):
                errors.append(f"PineCD item outside canonical BP: {rel(path)}: {ident}")

    # Known features that were split into dedicated packs must not silently grow back in BP15.
    for item in sorted(FORBIDDEN_IN_INTEGRATED_BP):
        if (INTEGRATED_BP / item).exists():
            errors.append(f"dedicated-pack file copied back into integrated BP: {item}")

    # Report byte-identical cross-pack payloads. Pack icons are intentionally duplicated
    # between the BP/RP halves of some addons and are excluded from the regression budget.
    hashes: dict[str, list[tuple[Path, Path, int]]] = defaultdict(list)
    for pack, path in all_files:
        if path.name == "pack_icon.png":
            continue
        blob = path.read_bytes()
        sha = hashlib.sha256(blob).hexdigest()
        hashes[sha].append((pack, path, len(blob)))

    duplicate_bytes = 0
    groups = []
    for entries in hashes.values():
        owners = sorted({pack for pack, _, _ in entries})
        if len(owners) < 2:
            continue
        size = entries[0][2]
        duplicate_bytes += size * (len(owners) - 1)
        groups.append((size, entries))

    groups.sort(key=lambda row: row[0], reverse=True)
    print(f"packs={len(packs)} cross_pack_exact_duplicate_bytes={duplicate_bytes}")
    for size, entries in groups[:12]:
        print(f"duplicate {size} bytes:")
        for _, path, _ in entries:
            print(f"  {rel(path)}")

    # A few small shared compatibility assets are currently intentional. Large regressions
    # should fail loudly so another 100+ MiB copy cannot accumulate unnoticed.
    if duplicate_bytes > 5_000_000:
        errors.append(
            f"cross-pack exact duplicate payload exceeds 5 MB budget: {duplicate_bytes} bytes"
        )

    if errors:
        print("\nPACK OWNERSHIP AUDIT FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("PACK OWNERSHIP AUDIT PASSED")


if __name__ == "__main__":
    main()
