# Dungeons boss chest rewards

## Repair: armor-only nested tables

The 113 tables under `loot_tables/chests/diamond_chest/armor/` had unrelated food, ore, records, figures, and other addon rewards appended to their first pool. A normal armor base selected an armor part with weight 4 out of 308, and the selected part's primary reward was diluted again to 1 out of 305. This reduced the probability of obtaining any Dungeons armor from a typical boss chest to about 0.8425%.

Removed only these unrelated entries from the nested armor tables. The original set selection, item IDs, functions, and 70% / 85% extra-piece rolls are preserved. Common addon rewards remain in the boss chest's separate common-reward pool. Also corrected the nonexistent `armor/endrr/chestplate.json` reference in both `ender/base.json` and `ghost_kindler/base.json` to each set's own chestplate table.

A selected armor set now always yields its primary armor piece. Normal boss armor selection retains the original 2/3 chance of selecting a Dungeons set versus 1/3 for vanilla diamond armor. The Vengeful Heart's existing vanilla armor entries have zero weight, so its armor selection always selects a Dungeons set.

Repair versions: Dungeons BP 1.5.20 and RP 1.5.19. Version numbers skip over versions present in a separate, uncommitted local equipment task. Existing mutual dependencies and both root/world registration copies are synchronized, without changing UUIDs or order. The RP changes only to keep that existing dependency and pack version consistent.

Validation: `python tools/test_dungeons_boss_rewards.py`. Covers all 113 armor tables, missing/cross-set references, exact recursive armor probabilities, all 33 manifests and all four world registration files. In-game chest interaction has not been tested. This patch changes the loot tables reached by existing boss chest functions, not the key or opening mechanism.
