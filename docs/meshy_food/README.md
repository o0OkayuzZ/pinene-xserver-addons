# Pine Food: Meshy placement

All 35 dishes and ingredients retain their 2D inventory/held icons. Sneak + use on a block's top places the corresponding Meshy display entity, facing one of eight 45-degree directions. Survival consumes one item; creative does not. Hit a display to retrieve its matching item.

The user accepted the local placement, corrected top-surface height, size and flicker treatment. Displays use a uniform 1.65 visual scale. Zero-thickness triangles retain paired opposite faces, with `entity_alphatest_one_sided` selecting the camera-facing surface to avoid overlapping front/back rendering. Gelatin retains `entity_alphablend`. The original geometry and atlas pixels are unchanged by this material correction.

## Scope and compatibility

- Pine Food BP/RP: 0.2.0. Cooking Tools BP: 0.1.3 (dependency version only).
- Adds the five existing local items missing from main: cooking oil, gelatin, noodles, cheese and whole cheese, including their existing local recipes/icons/names.
- Existing item definitions, recipes, food values, icons and localized values are preserved.
- Dedicated `pine:meshy_*_placed` entity IDs avoid earlier prototype entity/block IDs. Old placed prototypes are not migrated.
- No held-item attachables, custom material definitions, or changes to the Cooking Tools UI/runtime are introduced.
- Original GLBs remain outside the runtime release. Provenance is recorded in `source_provenance.json`; `catalog.json` lists component mapping, source triangle counts and texture sizes.
- Triangle masks preserve the source outline, but custom smooth normals and PBR lighting are not equivalent to the GLB renderer. Gelatin transparency and client performance remain device-dependent.

## Checks

```text
node tools/meshy_food/test_placement.cjs
python tools/meshy_food/validate.py
python tools/audit_pack_ownership.py
```

The script tests cover all 35 items, survival/creative accounting, eight directions, zero-valued top-face hit heights, slab heights, normal eating, duplicate inputs, placement failures and item retrieval. They are mocked API tests, not an engine simulation. The asset validator checks references, texture dimensions, manifest dependencies, registration order and preservation of existing gameplay files against the release base.

After updating both packs, reconnect and accept the resource-pack download. Use `/function meshy_food/give_all` to obtain the 35 items in a test inventory. Server deployment and rollback evidence is maintained separately from this asset release; Git publication alone does not mean the running server has reloaded it.
