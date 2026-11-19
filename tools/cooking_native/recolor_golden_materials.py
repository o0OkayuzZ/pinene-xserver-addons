"""Recolor existing material pixels into a fixed gold palette, without image generation.

Requires Pillow. Neither pixel coordinates, dimensions nor alpha are changed.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
RP = Path('resource_packs/rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2')
SPEC = Path('docs/cooking_ui/golden-ingredients.json')
ART = Path('docs/cooking_ui/golden-material-art.json')
# A Minecraft-style gold ramp, chosen for this add-on (not a copied vanilla texture).
GOLD = ('593a0c', '80540f', 'a36d13', 'c78b17', 'e5ac20',
        'f7cd35', 'ffe15b', 'fff18a', 'ffffca')
PALETTE = tuple(tuple(bytes.fromhex(color)) for color in GOLD)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def recolor(source):
    rgba = source.convert('RGBA')
    raw = rgba.tobytes()
    pixels = [tuple(raw[index:index+4]) for index in range(0, len(raw), 4)]
    luminance = [(54*r + 183*g + 19*b + 128)//256 for r, g, b, a in pixels]
    visible = sorted(value for value, pixel in zip(luminance, pixels) if pixel[3] >= 16)
    if not visible:
        raise ValueError('Material has no visible pixels')
    low = visible[(len(visible)-1)//100]
    high = visible[((len(visible)-1)*99)//100]
    width = max(1, high-low)
    result = []
    for pixel, value in zip(pixels, luminance):
        if pixel[3] == 0:
            result.append(pixel)
            continue
        level = max(0, min(8, ((value-low)*8 + width//2)//width))
        result.append((*PALETTE[level], pixel[3]))
    output = Image.new('RGBA', rgba.size)
    output.putdata(result)
    assert output.size == rgba.size
    assert output.getchannel('A').tobytes() == rgba.getchannel('A').tobytes()
    return output, {'luminance_low': low, 'luminance_high': high}


def outputs(root=ROOT):
    spec = json.loads((root/SPEC).read_text(encoding='utf-8-sig'))
    files = {}
    assets = []
    for material in spec['materials']:
        slug = material['base_id'].split(':', 1)[1]
        reference = RP/'textures/items'/(slug+'.png')
        target = RP/'textures/items'/('golden_'+slug+'.png')
        original = (root/reference).read_bytes()
        with Image.open(io.BytesIO(original)) as image:
            output, shading = recolor(image)
            buffer = io.BytesIO()
            output.save(buffer, format='PNG', optimize=True)
            data = buffer.getvalue()
            # PNG compression can differ between Pillow/zlib versions. Keep an
            # existing encoding when its actual RGBA pixels already match.
            if (root/target).exists():
                existing = (root/target).read_bytes()
                with Image.open(io.BytesIO(existing)) as current:
                    if current.size == output.size and current.convert('RGBA').tobytes() == output.tobytes():
                        data = existing
            files[target] = data
            assets.append({
                'id': 'pine:golden_'+slug,
                'source_reference': reference.as_posix(),
                'source_sha256': sha(original),
                'output': target.as_posix(),
                'sha256': sha(data),
                'size': list(output.size),
                'alpha_sha256': sha(output.getchannel('A').tobytes()),
                'generation': 'deterministic_palette_recolor',
                'processing': 'RGB palette conversion only; original coordinates, dimensions and every alpha byte preserved.',
                'review_status': 'user_requested_mechanical_recolor',
                **shading,
            })
    manifest = {'schema_version': 2, 'method': 'mechanical_recolor_from_approved_sources',
                'palette_hex': ['#'+color for color in GOLD],
                'command': 'python tools/cooking_native/recolor_golden_materials.py --write',
                'image_generation_used': False, 'assets': assets}
    files[ART] = (json.dumps(manifest, ensure_ascii=False, indent=2)+'\n').encode('utf-8')
    return files


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--write', action='store_true')
    mode.add_argument('--check', action='store_true')
    args = parser.parse_args()
    changed = []
    for relative, expected in outputs().items():
        target = ROOT/relative
        if not target.exists() or target.read_bytes() != expected:
            changed.append(relative.as_posix())
            if args.write:
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(expected)
    print(json.dumps({'sprites': 7, 'image_generation_used': False,
                      'dimensions_and_alpha_preserved': True,
                      'changed' if args.write else 'drift': changed}, ensure_ascii=False))
    if args.check and changed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
