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

## Deathnerite / Parcanite

The current tree differs from the old 74-file / 588 KB estimate. RP02 contains 65 named Deathnerite/Parcanite resources, all byte-identical at the same paths in RP06 (77,258 working-tree bytes before removal). RP06 contains 72 named resources. RP15 contains metadata and one animation, but no PNG files: all 35 of its atlas texture paths resolve in RP06.

RP06 is therefore the canonical rendering owner. RP15 retains its metadata role; moving it wholesale would not make it self-contained. RP02's 65 duplicate resources were removed without changing identifiers, geometry, UVs, paths or stacking order. RP15's sole animation was also removed after JSON comparison confirmed it has exactly the same animation identifier and content as RP06 (only whitespace differs). RP02 and RP15 now explicitly depend on RP06, and BP05 plus the BP15/BP09/RP07 dependency chain are versioned together.

The audit contract lists each removed rendering path, requires its canonical copy, rejects reintroduced copies at the old locations, and checks all RP15 atlas texture paths in RP06. Dungeons rendering remains in its existing resource pack. A complete move into RP15 remains a possible separate architectural change; it would require handling Dungeons references to shared assets and validating the resulting stack in the engine.

## Remaining shared images

- RP01 owns the `onso` atlas key and identical image; the RP02 copy (342,963 bytes) and duplicate atlas entry were removed. `myname:onso`, its recipes and localized names stay intact.
- RP14 owns `pancake_kiji`; the RP02 copy (60,232 bytes) and duplicate atlas entry were removed. RP02 explicitly depends on RP01 and RP14.
- RP07 already contained all 20 zombie armor icons under `textures/items`, but its atlas still pointed at RP02's `textures/merged_equipment` copies. The atlas now points at the byte-identical RP07 images; all 20 RP02 copies (32,895 bytes) were removed. Every atlas key and item identifier remains unchanged. CI verifies the new paths and rejects references to removed paths.
- Total image payload removed in this step: 436,090 bytes across 22 files.
- The 254,805-byte fossil duplicate is intentionally retained. RP02's `mystery_fossil` terrain key, RP05's `figure_fossil_placed` client entity and the generated `pinenite_outline` client entity all consume `textures/blocks/mystery_fossil`. RP06's same pixels have bottom/side roles. A later alias migration must update the figure generator and generated texture references together while preserving the block's terrain key and UVs. Removing the PNG alone would break these consumers.
- The visually shared `zombie_stem_cell` / `enderite_ingot` image has different item roles; it is not included in the zombie armor cleanup.

The remaining cross-pack duplicate budget is tightened to 350,000 bytes, with the fossil exception accounting for most of the retained payload.
