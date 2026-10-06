"""Losslessly-enough optimize Meshy food assets for Bedrock runtime.

The Meshy export uses 1K/2K atlases for tiny placed-food entities. Bedrock uploads
those textures uncompressed to GPU memory, so scale every model atlas to at most
512 px on the long side and rescale the geometry UV space with it.

Geometry coordinates are also quantized to four decimals. This does not change
topology, scale, entity IDs, gameplay definitions, or held-item icons.
"""
from __future__ import annotations

from pathlib import Path
import json

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RP = next(ROOT.glob("resource_packs/rp_21_*"))
MODEL_DIR = RP / "models/entity/meshy_food"
TEXTURE_DIR = RP / "textures/models/meshy_food"
MAX_DIMENSION = 512
GEOMETRY_DECIMALS = 4
UV_DECIMALS = 3


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def write(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def quantize_number(value, decimals):
    if not isinstance(value, (int, float)):
        return value
    rounded = round(float(value), decimals)
    if abs(rounded) < 10 ** (-decimals):
        rounded = 0.0
    return int(rounded) if float(rounded).is_integer() else rounded


def quantize_vec(values, decimals):
    return [quantize_number(value, decimals) for value in values]


def scale_uv(uv, sx: float, sy: float):
    if isinstance(uv, list):
        if len(uv) >= 2:
            uv[0] = quantize_number(uv[0] * sx, UV_DECIMALS)
            uv[1] = quantize_number(uv[1] * sy, UV_DECIMALS)
        return
    if not isinstance(uv, dict):
        return
    for face in uv.values():
        if not isinstance(face, dict):
            continue
        if isinstance(face.get("uv"), list):
            face["uv"] = quantize_vec(
                [face["uv"][0] * sx, face["uv"][1] * sy], UV_DECIMALS
            )
        if isinstance(face.get("uv_size"), list):
            face["uv_size"] = quantize_vec(
                [face["uv_size"][0] * sx, face["uv_size"][1] * sy], UV_DECIMALS
            )


def optimize_model(name: str):
    geometry_path = MODEL_DIR / f"{name}.geo.json"
    texture_path = TEXTURE_DIR / f"{name}.png"
    geometry = read(geometry_path)
    geo = geometry["minecraft:geometry"][0]
    desc = geo["description"]
    old_w = int(desc["texture_width"])
    old_h = int(desc["texture_height"])

    with Image.open(texture_path) as source:
        if (source.width, source.height) != (old_w, old_h):
            raise AssertionError(
                f"{name}: geometry says {old_w}x{old_h}, PNG is {source.width}x{source.height}"
            )
        scale = min(1.0, MAX_DIMENSION / max(source.width, source.height))
        new_w = max(1, round(source.width * scale))
        new_h = max(1, round(source.height * scale))
        if (new_w != source.width or new_h != source.height):
            resized = source.resize((new_w, new_h), Image.Resampling.LANCZOS)
            resized.save(texture_path, format="PNG", optimize=True, compress_level=9)

    sx = new_w / old_w
    sy = new_h / old_h
    desc["texture_width"] = new_w
    desc["texture_height"] = new_h

    cubes = 0
    for bone in geo.get("bones", []):
        for key in ("pivot", "rotation"):
            if isinstance(bone.get(key), list):
                bone[key] = quantize_vec(bone[key], GEOMETRY_DECIMALS)
        for cube in bone.get("cubes", []):
            cubes += 1
            for key in ("origin", "size", "pivot", "rotation"):
                if isinstance(cube.get(key), list):
                    cube[key] = quantize_vec(cube[key], GEOMETRY_DECIMALS)
            if "inflate" in cube:
                cube["inflate"] = quantize_number(cube["inflate"], GEOMETRY_DECIMALS)
            scale_uv(cube.get("uv"), sx, sy)

    write(geometry_path, geometry)
    return {
        "name": name,
        "old": [old_w, old_h],
        "new": [new_w, new_h],
        "cubes": cubes,
        "texture_bytes": texture_path.stat().st_size,
        "geometry_bytes": geometry_path.stat().st_size,
    }


def main():
    rows = []
    for geometry_path in sorted(MODEL_DIR.glob("*.geo.json")):
        rows.append(optimize_model(geometry_path.name.removesuffix(".geo.json")))
    before_pixels = sum(r["old"][0] * r["old"][1] for r in rows)
    after_pixels = sum(r["new"][0] * r["new"][1] for r in rows)
    result = {
        "models": len(rows),
        "max_texture_dimension": MAX_DIMENSION,
        "before_pixels": before_pixels,
        "after_pixels": after_pixels,
        "pixel_reduction_percent": round((1 - after_pixels / before_pixels) * 100, 1),
        "texture_mib": round(sum(r["texture_bytes"] for r in rows) / 1024 / 1024, 2),
        "geometry_mib": round(sum(r["geometry_bytes"] for r in rows) / 1024 / 1024, 2),
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
