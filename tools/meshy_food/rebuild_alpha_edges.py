"""Rebuild/check runtime atlases from the recorded approved pre-shrink assets."""
from pathlib import Path
import argparse
import io
import json
import subprocess

from PIL import Image
from alpha_edges import edge_preserving_resize

ROOT = Path(__file__).resolve().parents[2]
SOURCE_REF = "cb95f2b791e53aa9344b3e7d047f35172bcfdc5d"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--source-ref", default=SOURCE_REF)
    args = parser.parse_args()
    rp = ROOT / "resource_packs/rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2"
    catalog = json.loads((ROOT / "docs/meshy_food/catalog.json").read_text(encoding="utf-8"))
    for row in catalog:
        name = row["name"]
        rel = f"textures/models/meshy_food/{name}.png"
        def original(suffix):
            path = (rp.relative_to(ROOT) / suffix).as_posix()
            return subprocess.check_output(["git", "-c", "safe.directory=" + ROOT.as_posix(), "show", args.source_ref + ":" + path], cwd=ROOT)
        source = Image.open(io.BytesIO(original(rel)))
        geo_rel = f"models/entity/meshy_food/{name}.geo.json"
        old = json.loads(original(geo_rel))["minecraft:geometry"][0]
        geo = json.loads((rp / geo_rel).read_text(encoding="utf-8"))["minecraft:geometry"][0]
        size = (geo["description"]["texture_width"], geo["description"]["texture_height"])
        assert source.size == (old["description"]["texture_width"], old["description"]["texture_height"])
        assert len(geo["bones"]) == len(old["bones"])
        sx, sy = source.width / size[0], source.height / size[1]
        for bone, old_bone in zip(geo["bones"], old["bones"]):
            assert len(bone["cubes"]) == len(old_bone["cubes"])
            for cube, old_cube in zip(bone["cubes"], old_bone["cubes"]):
                for face, uv in cube["uv"].items():
                    for field in ("uv", "uv_size"):
                        for i, value in enumerate(uv[field]):
                            assert abs(value * (sx if i == 0 else sy) - old_cube["uv"][face][field][i]) <= 0.01, name
        result = edge_preserving_resize(source, size)
        if args.check:
            live = Image.open(rp / rel).convert("RGBA")
            assert live.size == size and live.tobytes() == result.tobytes(), name
        else:
            result.save(rp / rel, format="PNG", optimize=True, compress_level=9)
    print(json.dumps({"result": "PASS", "models": len(catalog), "check_only": args.check, "source_ref": args.source_ref}))


if __name__ == "__main__":
    main()
