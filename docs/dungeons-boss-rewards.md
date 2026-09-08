# Dungeons boss chest rewards

## Repair: armor-only nested tables

The 113 tables under `loot_tables/chests/diamond_chest/armor/` had unrelated food, ore, records, figures, and other addon rewards appended to their first pool. A normal armor base selected an armor part with weight 4 out of 308, and the selected part's primary reward was diluted again to 1 out of 305. This reduced the probability of obtaining any Dungeons armor from a typical boss chest to about 0.8425%.

Removed only these unrelated entries from the nested armor tables. The original set selection, item IDs, functions, and 70% / 85% extra-piece rolls are preserved. Common addon rewards remain in the boss chest's separate common-reward pool. Also corrected the nonexistent `armor/endrr/chestplate.json` reference in both `ender/base.json` and `ghost_kindler/base.json` to each set's own chestplate table.

A selected armor set now always yields its primary armor piece. Normal boss armor selection retains the original 2/3 chance of selecting a Dungeons set versus 1/3 for vanilla diamond armor. The Vengeful Heart's existing vanilla armor entries have zero weight, so its armor selection always selects a Dungeons set.

Repair versions: Dungeons BP 1.5.20 and RP 1.5.19. Version numbers skip over versions present in a separate, uncommitted local equipment task. Existing mutual dependencies and both root/world registration copies are synchronized, without changing UUIDs or order. The RP changes only to keep that existing dependency and pack version consistent.

Validation: `python tools/test_dungeons_boss_rewards.py`. Covers all 113 armor tables, missing/cross-set references, exact recursive armor probabilities, all 33 manifests and all four world registration files. In-game chest interaction has not been tested. This patch changes the loot tables reached by existing boss chest functions, not the key or opening mechanism.

## Increase: more rewards per opening

All 12 boss chest tables retain their existing entries and relative weights. Only these roll counts change:

| Reward pool | Before | After |
| --- | --- | --- |
| Common bonus rewards | 1 | 2 |
| Armor, except Halloween mixed pool | 1 | 2 |
| Diamond dust / blueprint pool | 2 (Heart: 3) | 3 (Heart: 4) |
| Final mineral pool | 2–3 | 3–4 |
| Halloween mixed weapons / armor / artifact | 2–3 | 3–4 |

Ordinary melee, ranged, and artifact reward counts remain one each. Existing per-stack counts, empty outcomes in material/decorative pools, and additional armor piece chances are unchanged. Rolls can select the same reward again; this is not a guarantee of unique armor parts or complete sets.

After both changes, the probability of at least one Dungeons armor piece per chest is:

- Normal bosses, including Endersent and Nameless One: `1 - (1/3)^2 = 88.8889%`.
- Vengeful Heart of Ender: 100%; two set selections.
- Halloween: `1 - ((8/11)^3 + (8/11)^4)/2 = 66.78%` approximately. The mixed pool can still select weapons or the artifact instead of armor.

The normal armor pool yields two vanilla pieces at minimum when both selections choose vanilla; a selected Dungeons set yields one primary piece and independently rolls three extra pieces at 70%. The Heart's extra-piece chance remains 85%. Normal expected armor-piece count is 4.8 per chest, not necessarily four distinct slots.

Final versions: Dungeons BP 1.5.21 / RP 1.5.20. All existing dependencies and root/world registrations are synchronized. The quantity test checks all 12 boss tables. Publication to GitHub does not apply the changes to a running server or an existing local world.
