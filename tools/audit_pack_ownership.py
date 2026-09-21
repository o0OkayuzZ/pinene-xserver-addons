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
BLUE_APPLE_BP = BP_ROOT / "bp_03_969b1f80-d29c-454f-ab4e-9798b508c1fc"
BLUE_APPLE_RP = RP_ROOT / "rp_16_47cd51f7-0f9e-4bfa-a9ce-c8ce180abd78"
INTEGRATED_BP = BP_ROOT / "bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639"
INTEGRATED_RP = RP_ROOT / "rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a"
PVP_BP = BP_ROOT / "bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3"
PVP_RP = RP_ROOT / "rp_20_ef57c45f-1b60-42a3-8d26-4998db1b5055"

FORBIDDEN_IN_INTEGRATED_BP = {
    "loot_tables/tcow.json",
    "spawn_rules/cow.json",
    "loot_tables/blocks/quartz_cluster.json",
    "loot_tables/blocks/quartz_crystal_block.json",
    "loot_tables/blocks/rose_quartz_cluster.json",
    "loot_tables/blocks/rose_quartz_crystal_block.json",
    "loot_tables/blocks/rose_quartz_large_bud.json",
    "entities/shingan_arrow.json",
    "items/shingan_arrow.item.json",
    "items/tenrai_wedge.item.json",
    "loot_tables/blocks/dragon_relic.json",
    "scripts/elemental_status.js",
    "scripts/pvp_island/config.js",
    "scripts/pvp_island/dragon_relic_display.js",
    "scripts/pvp_island/dragon_relic_gateway.js",
    "items/blue_apple.item.json",
    "items/blue_diamond_apple.item.json",
    "items/enchanted_blue_diamond_apple.item.json",
    "recipes/blue_diamond_apple.recipe.json",
    "recipes/enchanted_blue_diamond_apple.recipe.json",
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

FORBIDDEN_IN_INTEGRATED_RP = {
    "animations/dragon_relic_held.animation.json",
    "attachables/tenrai_wedge.attachable.json",
    "entity/dragon_relic_display.entity.json",
    "entity/shingan_arrow.entity.json",
    "models/entity/pinene_pvp/dragon_relic.geo.json",
    "textures/items/dragon_relic.png",
    "textures/items/blue_apple.png",
    "textures/items/blue_diamond_apple.png",
    "textures/items/enchanted_blue_diamond_apple.png",
}

JUNK_RE = re.compile(
    r"(?:\.bak(?:_|\.|$)|_bak(?:_|\.|$)|/(?:_?backup)(?:/|_|$)|/old(?:/|_|$)|desktop\.ini$|thumbs\.db$)",
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

    shared_textures = load_json(ROOT / "tools/shared_texture_ownership.json")
    moved_texture_paths = set()
    for entry in shared_textures:
        old = RP_ROOT / entry["oldPack"] / entry["oldPath"]
        canonical = RP_ROOT / entry["owner"] / entry["path"]
        if old.exists():
            errors.append(f"Shared texture copied back into integrated RP: {rel(old)}")
        if not canonical.is_file():
            errors.append(f"Missing canonical shared texture: {rel(canonical)}")
        atlas = load_json(RP_ROOT / entry["atlasPack"] / "textures/item_texture.json")["texture_data"]
        if atlas.get(entry["atlasKey"], {}).get("textures") != entry["texture"]:
            errors.append(f"Shared texture atlas points outside its owner: {entry['atlasKey']}")
        if entry["oldPath"] != entry["path"]:
            moved_texture_paths.add(entry["oldPath"].rsplit(".", 1)[0])
    for _, path in all_files:
        if path.suffix == ".json":
            text = path.read_text(encoding="utf-8-sig", errors="replace")
            for old in moved_texture_paths:
                if f'"{old}"' in text:
                    errors.append(f"Reference to removed shared texture: {rel(path)}: {old}")

    deathnerite = load_json(ROOT / "tools/deathnerite_ownership.json")
    render_owner = RP_ROOT / deathnerite["resourceOwner"]
    metadata_owner = RP_ROOT / deathnerite["metadataOwner"]
    for source, key in ((INTEGRATED_RP, "removedIntegratedPaths"), (metadata_owner, "removedMetadataPaths")):
        for name in deathnerite[key]:
            if (source / name).exists():
                errors.append(f"Deathnerite resource copied outside its render owner: {rel(source / name)}")
            if not (render_owner / name).is_file():
                errors.append(f"Missing canonical Deathnerite resource: {rel(render_owner / name)}")

    owner_header = load_json(render_owner / "manifest.json")["header"]
    for source in (INTEGRATED_RP, metadata_owner):
        dependencies = load_json(source / "manifest.json").get("dependencies", [])
        if not any(d.get("uuid") == owner_header["uuid"] and d.get("version") == owner_header["version"] for d in dependencies):
            errors.append(f"Missing Deathnerite rendering dependency: {rel(source)}")

    def texture_paths(value):
        if isinstance(value, str) and value.startswith("textures/"):
            yield value
        elif isinstance(value, dict):
            for child in value.values():
                yield from texture_paths(child)
        elif isinstance(value, list):
            for child in value:
                yield from texture_paths(child)

    for atlas_name in ("item_texture.json", "terrain_texture.json"):
        for name in texture_paths(load_json(metadata_owner / "textures" / atlas_name).get("texture_data", {})):
            if not any((render_owner / (name + suffix)).is_file() for suffix in (".png", ".tga", ".jpg")):
                errors.append(f"Deathnerite atlas texture missing from render owner: {name}")

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

        if path.name == "item_texture.json" and pack != BLUE_APPLE_RP:
            data = load_json(path).get("texture_data", {})
            bad = sorted(set(data) & {"blue_apple", "blue_diamond_apple", "enchanted_blue_diamond_apple"})
            if bad:
                errors.append(f"Blue Apple atlas keys outside canonical RP: {rel(path)}: {bad}")

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

            blue_apple_ids = {
                "resetapple:blue_apple",
                "resetapple:blue_diamond_apple",
                "resetapple:enchanted_blue_diamond_apple",
                "myname:blue_apple",
                "myname:blue_diamond_apple",
                "myname:enchanted_blue_diamond_apple",
            }
            if pack != BLUE_APPLE_BP and ident in blue_apple_ids:
                errors.append(f"Blue Apple item outside canonical BP: {rel(path)}: {ident}")

    # Known features that were split into dedicated packs must not silently grow back in BP15.
    # Saved items and projectiles require actual legacy definitions, not just runtime aliases.
    for pack, folder, kind, identifiers in (
        (BLUE_APPLE_BP, "items", "minecraft:item", {f"{namespace}:{name}" for namespace in ("myname", "resetapple") for name in ("blue_apple", "blue_diamond_apple", "enchanted_blue_diamond_apple")}),
        (PVP_BP, "items", "minecraft:item", {"pinen:tenrai_wedge", "pinen:shingan_arrow", "pinene_pvp:tenrai_wedge", "pinene_pvp:shingan_arrow"}),
        (PVP_BP, "entities", "minecraft:entity", {"pinen:shingan_arrow", "pinene_pvp:shingan_arrow"}),
        (PVP_RP, "entity", "minecraft:client_entity", {"pinen:shingan_arrow", "pinene_pvp:shingan_arrow"}),
        (PVP_RP, "attachables", "minecraft:attachable", {"pinen:tenrai_wedge", "pinene_pvp:tenrai_wedge"}),
    ):
        counts = defaultdict(int)
        for path in (pack / folder).rglob("*.json"):
            ident = load_json(path).get(kind, {}).get("description", {}).get("identifier")
            if ident in identifiers:
                counts[ident] += 1
        for ident in sorted(identifiers):
            if counts[ident] != 1:
                errors.append(f"Compatibility definition must have one owner in {rel(pack)}/{folder}: {ident} (found {counts[ident]})")

    for lang_name in ("en_US.lang", "ja_JP.lang"):
        lang = (BLUE_APPLE_RP / "texts" / lang_name).read_text(encoding="utf-8-sig")
        for name in ("blue_apple", "blue_diamond_apple", "enchanted_blue_diamond_apple"):
            if f"item.myname:{name}.name=" not in lang:
                errors.append(f"Missing legacy Blue Apple localization: {lang_name}: {name}")

    for item in sorted(FORBIDDEN_IN_INTEGRATED_BP):
        if (INTEGRATED_BP / item).exists():
            errors.append(f"dedicated-pack file copied back into integrated BP: {item}")

    for item in sorted(FORBIDDEN_IN_INTEGRATED_RP):
        if (INTEGRATED_RP / item).exists():
            errors.append(f"dedicated-pack file copied back into integrated RP: {item}")

    integrated_item_atlas = INTEGRATED_RP / "textures/item_texture.json"
    if integrated_item_atlas.exists():
        atlas = load_json(integrated_item_atlas).get("texture_data", {})
        bad = sorted(set(atlas) & {"pinene_pvp_dragon_relic", "tenrai_wedge", "shingan_arrow"})
        if bad:
            errors.append(f"PvP atlas keys copied back into integrated RP: {bad}")

    integrated_terrain_atlas = INTEGRATED_RP / "textures/terrain_texture.json"
    if integrated_terrain_atlas.exists():
        atlas = load_json(integrated_terrain_atlas).get("texture_data", {})
        bad = sorted(set(atlas) & {"pinene_pvp_dragon_relic_anchor", "pinene_pvp_dragon_relic_item"})
        if bad:
            errors.append(f"PvP terrain keys copied back into integrated RP: {bad}")

    integrated_blocks = INTEGRATED_RP / "blocks.json"
    if integrated_blocks.exists():
        blocks = load_json(integrated_blocks)
        if "pinene_pvp:dragon_relic_block" in blocks:
            errors.append("PvP block entry copied back into integrated RP: pinene_pvp:dragon_relic_block")

    for lang_name in ("en_US.lang", "ja_JP.lang"):
        lang_path = INTEGRATED_RP / "texts" / lang_name
        if not lang_path.exists():
            continue
        lines = lang_path.read_text(encoding="utf-8-sig", errors="replace").splitlines()
        forbidden_prefixes = (
            "item.pinene_pvp:dragon_relic.name=",
            "tile.pinene_pvp:dragon_relic_block.name=",
            "item.pinen:tenrai_wedge.name=",
            "item.pinen:shingan_arrow.name=",
        )
        if any(line.startswith(forbidden_prefixes) for line in lines):
            errors.append(f"PvP localization copied back into integrated RP: {rel(lang_path)}")

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
    if duplicate_bytes > 350_000:
        errors.append(
            f"cross-pack exact duplicate payload exceeds 350 KB budget: {duplicate_bytes} bytes"
        )

    if errors:
        print("\nPACK OWNERSHIP AUDIT FAILED")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print("PACK OWNERSHIP AUDIT PASSED")


if __name__ == "__main__":
    main()
