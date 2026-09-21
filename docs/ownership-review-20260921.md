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

PR #10 moved three legacy items and two recipes unchanged, relocated the unique diamond texture, and removed the two identical PNG copies (3,125 bytes). RP16 is the sole atlas owner. This review additionally supplies missing legacy English/Japanese item names and guards all six definitions and the legacy names in CI. BP03 is 1.0.9 and RP16 is 1.0.7 after integrating NF release main `c348d0d9` through PR #9.

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

## Metadata and validation

The review found pre-existing stale BP02→RP05 and BP04→RP01 dependency versions, plus stale registrations for the grave, More Geodes, Dungeons and Infinite Castle packs. BP02/BP04 dependencies now match their current resource manifests; BP02/BP04 were versioned accordingly. Root and bundled-world registrations, README and the website registry now match every current manifest. No world pack ordering was changed. Infinite Castle source/mirror main and the UUID-based export contract were checked before updating its stale registration values; its implementation and mirror were not edited.

CI now checks UUID uniqueness, header/module versions, UUID dependency versions, complete and unique root/bundled-world registrations, README rows and website entries. Four regression tests cover matching metadata, stale nested-world registrations, missing registrations, and stale dependency/module versions. The existing Infinite Castle exporter workflow remains in place.

The final local ownership audit reports 272,603 cross-pack duplicate bytes. This metric counts extra pack owners per identical blob, not every repeated filename within a pack. Runtime changes are covered by nine mocked PvP tests; engine acceptance, visuals and saved-world loading still require an in-game check.

## Final integration snapshot

The stack was refreshed after NF version release `c348d0d9` and publication commit `97562c99` reached main. The latter was discovered during verification and is also preserved, including NF release records, website updates and registry provenance.

Integration order: main `97562c99` -> PR #9 `947f9be9` -> PR #10 `3f58a02f` -> PR #11. Each PR contains its latest parent. All implementation files in each PR are unchanged from its previously reviewed head; only metadata/version synchronization and this report changed beyond the main updates. NF/Mycology runtime and authoring files match latest main exactly.

Versions are calculated per stage from the latest parent and previous PR head. Packs with payload or dependency-schema changes and all reverse dependents receive a patch above both prior values. Unaffected packs retain current main/parent versions. UUIDs, module identities, Script API dependencies and pack order are preserved.

| Pack | NF main | PR #9 | PR #10 | PR #11 |
| --- | --- | --- | --- | --- |
| BP_03 | 1.0.6 | 1.0.6 | 1.0.9 | 1.0.9 |
| BP_05 | 2.12.26 | 2.12.26 | 2.12.26 | 2.12.28 |
| BP_09 | 1.2.7 | 1.2.8 | 1.2.9 | 1.2.10 |
| BP_15 | 1.0.75 | 1.0.76 | 1.0.77 | 1.0.78 |
| BP_17 | 0.2.24 | 0.2.26 | 0.2.26 | 0.2.26 |
| RP_02 | 1.0.62 | 1.0.63 | 1.0.64 | 1.0.66 |
| RP_07 | 1.2.8 | 1.2.9 | 1.2.10 | 1.2.11 |
| RP_15 | 1.0.105 | 1.0.105 | 1.0.105 | 1.0.107 |
| RP_16 | 1.0.4 | 1.0.4 | 1.0.7 | 1.0.7 |
| RP_20 | 0.2.23 | 0.2.25 | 0.2.25 | 0.2.25 |

Metadata checks pass for all 34 active packs: header/module versions, UUID dependency versions, root and bundled-world registrations, README rows and website entries. All registrations preserve their original order. PvP ownership definitions and runtime payloads are unchanged by this refresh.

Committed BP/RP payload totals (Git blob bytes, excluding documentation/tools):

| Snapshot | Bytes |
| --- | ---: |
| main 97562c99 | 323,580,547 |
| PR #9 | 312,747,507 |
| PR #10 | 312,727,643 |
| PR #11 | 312,215,157 |

Net reduction versus latest main: 11,365,390 bytes. Additional reduction after PR #10: 512,486 bytes. No PR merge or Xserver deployment was performed by this review.
