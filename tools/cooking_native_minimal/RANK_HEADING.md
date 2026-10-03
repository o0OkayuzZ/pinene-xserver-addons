# Native cooking header rank — 2026-10-03

The user observed that the actionbar is hidden by the native crafting screen.
Use the existing `minecraft:crafting_table.table_name` header instead of adding an overlay or custom UI.
The earlier statement that showing a rank anywhere inside the native UI was nearly impossible was too broad: the supported native table title is configurable.

## Implementation
- Native headers: `料理  Rank II`, `料理  Rank III`, `料理  Rank IV`, `料理  Rank VI`, `料理  Rank VII` for copper, iron, gold, diamond and netherite.
- The displayed rank is the placed knife's crafting limit, not the selected recipe's rank.
- The no-knife base header remains `料理`; its recipe tags stay locked.
- Only five table_name values per cutting-board file changed in the existing world `料理UI試験場（ナイフ連携）` (13 blocks, 65 strings), plus the matching source compiler and tests.
- Existing native fonts, label controls, 3x3 grid, recipe tags, recipes, knife handling, and actionbar code were not modified.
- No forced screen close/reopen, render timer, new resource-pack UI or item-name changes.

## Verification
- Python tests: 28 passed. JavaScript mock regressions: 32 passed. No skips.
- Every installed block was compared semantically; reverting only its table_name strings reproduces its exact prior JSON data.
- 530 other inspected world/shared-pack files unchanged; backup paths and counts are recorded in RANK_HEADING_STATUS.json.
- Main, Xserver and world databases were not edited. No game input was sent.
- Save, leave and re-enter the SAME world to reload block definitions. Native visual rendering, clipping and rank changes after replacing a knife still require engine verification; no screenshot success is claimed.

Primary specification: https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_crafting_table?view=minecraft-bedrock-stable
Mojang reference inspected: bedrock-samples 46ba6ea985fb5a92d79a9419198f10dda14c199d, resource_pack/ui/inventory_screen.json; its native 3x3 label control is 84 by 10. This source inspection is not a runtime font measurement.
