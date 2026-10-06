# Alylica / Meshy performance pass — 2026-10-06

## Scope

This pass targets the two largest regressions identified after the Alylica 2.1.3
update and the Meshy 3D food rollout. Gameplay definitions, recipes, item IDs,
placed-food entity IDs, model topology, and Dungeons combat timing-sensitive
loops are intentionally preserved.

## Meshy food

- 35 placed-food model atlases are capped at 512 px on the long side.
- Total model-atlas pixels: **91,226,112 -> 7,077,888 (-92.2%)**.
- Estimated raw RGBA texture memory: **348 MiB -> 27 MiB** before mipmaps.
- Estimated RGBA + mipmaps: **~464 MiB -> ~36 MiB**.
- Compressed model textures: **~69.45 MiB -> ~8.20 MiB**.
- Pine Food RP total: **~77.50 MiB -> ~13.64 MiB**.
- Geometry JSON: **~8.04 MiB -> ~5.35 MiB** by numeric quantization.
- Geometry topology remains **23,252 cubes**; maximum position/rotation
  quantization error versus main is below **0.00005** model units.
- UV coordinates and geometry texture dimensions are rescaled with each atlas,
  so the models retain their original texture layout.

The model topology is deliberately not aggressively decimated in this pass.
The texture-memory reduction is much larger and is safe to validate without
introducing holes into Meshy's alpha-masked triangle planes.

## Alylica polling

Baseline Alylica 2.1.3 had roughly 180 `system.runInterval` callbacks, including
about 100 callbacks with the default one-tick period.

This pass:

- consolidates **18 identical player scoreboard countdown loops** into one
  per-tick player pass;
- consolidates **6 quiver cooldown pollers** into one per-tick player pass;
- throttles **19 passive/UI/advancement/safety pollers** to 2-20 ticks;
- leaves timing-sensitive projectile, boss, stun, void, Ancient Hunt transition,
  and active combat loops unchanged.

Static result:

- total runInterval calls: **~180 -> 158**
- default one-tick runInterval calls: **~100 -> 67**

## Validation

- Meshy release validator passes for all 35 models and 90 protected gameplay files.
- 13 targeted Python regression tests pass.
- 6 Dungeons catalog / pack metadata tests pass.
- All 43 changed JavaScript files pass `node --check`.
- `git diff --check` passes.
- Pack registration UUID duplication was previously verified as zero.

Client gameplay verification is still required after deployment, especially with
several placed 3D foods visible at once and during an Ancient Hunt combat scene.
