# Ownership review, 2026-09-21

Reviewed main `294914f3`, PvP PR #9 `903cb226`, and Blue Apple PR #10 `1ef549fb`. Work is limited to GitHub and isolated local checkouts; no server deployment or saved-world edits.

## PvP

BP17/RP20 retain both `pinen:tenrai_wedge` / `pinen:shingan_arrow` and their `pinene_pvp:*` equivalents. The legacy item, entity and client definitions were moved without changing their contents. RP20 supplies the shared textures, geometry and localization. BP15 no longer loads the duplicate status implementation; the GF gate still uses the same dimension ID.

Review fixes: consuming a one-item wedge clears the equipment slot without assigning an invalid zero ItemStack amount; charged lightning amplification now requires the target to remain in the PvP dimension. Nine mocked runtime tests cover both namespaces, item consumption, arrow activation and island boundaries. CI also requires all compatibility definitions. These tests do not certify engine rendering or saved-world loading.

## Blue Apple

BP03/RP16 own all six item IDs. `resetapple:blue_apple` appears in 44 loot-table files; `myname:blue_apple` appears in 14. Both legacy recipe identifiers and ingredients remain unchanged. Existing saved items keep their IDs.

The two namespaces are not interchangeable aliases:

| Variant | Nutrition | Saturation modifier | Current behavior | Legacy behavior |
| --- | ---: | ---: | --- | --- |
| Blue | 8 | 0.8 | use duration 1.6 | use duration 32 |
| Diamond | 18 | 1.2 | effects applied by BP03 script | effects in food JSON; use duration 32 |
| Enchanted diamond | 120 | 1.2 | effects applied by BP03 script | effects in food JSON; use duration 32 |

The effect names, numeric durations and amplifiers match, but the JSON and Script API mechanisms cannot be assumed to have identical duration semantics. This cleanup intentionally preserves both behaviors. No historical evidence establishes that every old item should be converted to the current behavior: both were present in the initial server backup, and the later shared-resource commit only changed metadata. Balancing or migration requires a separate decision and engine validation.

PR #10 moved three legacy items and two recipes unchanged, relocated the unique diamond texture, and removed the two identical PNG copies (3,125 bytes). RP16 is the sole atlas owner. This review additionally supplies missing legacy English/Japanese item names and guards all six definitions and the legacy names in CI. BP03 is 1.0.8 and RP16 is 1.0.6 after this review.
