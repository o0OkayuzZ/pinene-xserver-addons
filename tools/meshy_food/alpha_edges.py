"""Shrink alpha-masked food atlases without dropping covered triangle edges.

This is an offline asset build dependency; no game scripts or geometry change.
"""
from __future__ import annotations

import numpy as np
from PIL import Image


def edge_preserving_resize(source: Image.Image, size: tuple[int, int]) -> Image.Image:
    if source.size == size:
        return source.copy()
    width, height = size
    if width <= 0 or height <= 0 or source.width % width or source.height % height:
        raise ValueError("Atlas reduction must use positive integer scale factors")
    fx, fy = source.width // width, source.height // height
    if fx < 1 or fy < 1:
        raise ValueError("Upscaling is not an atlas optimization")
    pixels = np.asarray(source.convert("RGBA"), dtype=np.float64)
    blocks = pixels.reshape(height, fy, width, fx, 4)
    alpha = blocks[..., 3]
    weights = alpha.sum(axis=(1, 3))
    rgb = (blocks[..., :3] * alpha[..., None]).sum(axis=(1, 3))
    rgb = np.divide(rgb, weights[..., None], out=np.zeros_like(rgb), where=weights[..., None] > 0)
    # Alpha-test materials discard averaged thin edge fragments. Preserve the
    # maximum covered source sample while keeping wholly empty blocks empty.
    covered = alpha.max(axis=(1, 3)) >= 128
    rgba = np.concatenate([
        np.rint(rgb).clip(0, 255).astype(np.uint8),
        (covered * 255).astype(np.uint8)[..., None],
    ], axis=2)
    return Image.fromarray(rgba)
