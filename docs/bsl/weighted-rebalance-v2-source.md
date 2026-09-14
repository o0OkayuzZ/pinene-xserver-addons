# BSL Weighted Rebalance v2 — Implementation Spec

Status: design locked enough to implement; no direct GitHub push performed because the connected GitHub integration cannot create refs/branches (403).

## 1. Core design

Loot rarity and chest fullness are separate axes.

- More occupied-looking slots do **not** automatically mean rarer loot.
- Large stacks are generally split into smaller repeated draws.
- Repeated draws of the same item are allowed.
- The old BSL's large `set_count` ranges are reduced, while variety and visual fullness are retained.
- Special progression chests stay bespoke instead of being forced into the generic system.

## 2. Normal BSL

### Profile draw ranges

| Profile | Base weighted draws |
|---|---:|
| Early | 13–17 |
| Mid | 14–18 |
| High | 14–19 |
| End | 15–20 |
| Special | bespoke; unchanged |

These are draw counts, not guaranteed physical occupied-slot counts. Native Minecraft chest filling can split/merge stacks, so physical slot occupancy must be verified in-game.

### Generic normal-BSL conversion

For each non-Special chest:

1. Read the existing loot pools.
2. Separate BSL independent rare pools from the ordinary/base pools.
3. For ordinary pools, calculate each pool's expected draw count:
   - fixed rolls = rolls
   - ranged rolls = `(min + max) / 2`
   - multiply by pool-level `random_chance` when present
4. Use expected draw count as the **category weight**.
5. Within each category, keep the original entry weights.
6. Flatten the ordinary categories into one weighted base pool.
7. Replace the base pool's rolls with the Profile draw range above.
8. Reduce `set_count` amounts to roughly one quarter:
   - `24–64 -> 6–16`
   - `20–48 -> 5–12`
   - `16–48 -> 4–12`
   - `12–40 -> 3–10`
   - `12–32 -> 3–8`
   - `8–24 -> 2–6`
   - `6–18 -> 2–5`
   - `4–12 -> 1–3`
   - `3–10 -> 1–3`
   - `2–8 -> 1–2`
   - `2–6 -> 1–2`
   - `1–4 -> 1`
   - single-count equipment / records / templates remain 1
9. Keep repeated hits as repeated stacks instead of deliberately deduplicating them.
10. Preserve the existing independent BSL probabilities for Pancake / Golden Food / Enchanted Golden Food / Collectible / Warpstone / Blue Apple and structure-specific rare rewards unless separately changed.

### Normal BSL exceptions

Do not generic-convert:

- `ancient_city_ice_box.json`
- `bastion_treasure.json`
- `buriedtreasure.json`

Their bespoke food/progression/resource design remains intact.

## 3. Infinite Castle chest fullness

| Chest | Target occupied reward slots |
|---|---:|
| Guard | 16–20 |
| Curse | 16–20 |
| Wraith | 16–20 |
| Heavy | 16–20 |
| Mixed | 16–20 |
| Elite | 19–23 |
| Treasure Vault | 23–27 |

Normal encounter average target: ~18 slots.

### Important V4 change

Remove the old "one guaranteed anchor slot + 26 empty-inclusive draws" model.

New model:

1. Choose a target slot count from the range.
2. Shuffle the 27 physical chest slots.
3. Select exactly the first N distinct slots.
4. Every selected slot uses the **same non-empty weighted slot table** for that encounter type.
5. Unselected slots remain empty.
6. Persist the selected slot list and next index before native `/loot` calls so restart recovery stays duplication-safe.
7. Existing V2/V3 already-stocked chests must never refill.

This makes the former fixed/guaranteed slot part of the same uniform draw system.

## 4. Infinite Castle common slot weights

Starting common distribution for normal encounters:

| Category | Weight |
|---|---:|
| Red mushroom | 13 |
| Brown mushroom | 13 |
| Rotten flesh | 18 |
| Pancake family | 11 |
| Gold ingot | 13 |
| Gold block | 7 |
| Appraised mushroom | 4 |
| Potion | 7 |
| Encounter theme reward | 14 |
| **Total** | **100** |

At 18 draws, expected slot counts are approximately:

- Red mushroom: 2.34
- Brown mushroom: 2.34
- Rotten flesh: 3.24
- Pancake: 1.98
- Gold ingot: 2.34
- Gold block: 1.26
- Appraised mushroom: 0.72
- Potion: 1.26
- Theme reward: 2.52

Random variation is intentional: one chest may be mushroom-heavy, another gold-heavy, another rotten-flesh-heavy.

### Common quantities

- Red mushroom: **1–10 per slot**
- Brown mushroom: **1–10 per slot**
- Rotten flesh: **1–2 per slot**
- Pancake family: **1 per slot**
- Gold ingot: **5–12 per slot**
- Gold block: **1–3 per slot**
- Appraised mushroom: **1 per slot**
- Potion: **1 per slot**

Pancakes are a common Infinite Castle food, not a prestige rare.

## 5. Appraised Mycology rewards

Do not create a boosted Infinite-Castle rarity curve.

- First choose red/brown group.
- Use the existing Mycology species weights within that group.
- Quantity: 1.
- This preserves the original appraisal economy.
- ★10 remains naturally extremely rare because the original weighting is retained.

Unappraised vanilla red/brown mushrooms remain far more common than direct appraised drops.

## 6. Encounter themes

### Guard
Bias:
- iron ingot
- arrows
- gold
- diamond
- emerald
- combat-useful potions
- zombie stem cell slightly more likely than baseline

### Curse
Bias:
- XP bottles
- lapis
- ghast tears
- Golden Food
- Enchanted Golden Food slightly more likely
- extra potion outcomes

### Wraith
Bias:
- echo shards
- ender pearls
- phantom membrane
- XP
- night vision / invisibility / regeneration-style potions

Wraith is the best Infinite Castle route for echo shards.

### Heavy
Bias:
- gold blocks
- diamond
- ancient debris
- netherite scrap
- netherite ingot
- Deathnerite Ingot
- heavy/defensive potions

Heavy is the best normal encounter for Netherite/Deathnerite progression.

### Mixed
Broad mixture of the four normal themes with less specialization.

### Elite
19–23 slots and materially better rare/progression odds.

### Treasure Vault
23–27 slots. Large variety and multiple simultaneous strong hits are expected.

## 7. Potions

All three physical forms are allowed:

- normal: **50%**
- splash: **35%**
- lingering: **15%**

Use the strongest useful variant for each effect (`set_potion`).

Candidate pool:

- `strong_healing`
- `strong_regeneration`
- `strong_strength`
- `strong_swiftness`
- `strong_leaping`
- `strong_poison`
- `strong_harming`
- `strong_slowness`
- `strong_turtle_master`
- `long_fire_resistance`
- `long_nightvision`
- `long_water_breathing`
- `long_invisibility`
- `long_weakness`
- `long_slow_falling`

Theme-specific weights should be used rather than making every room identical.

## 8. Infinite Castle rare targets

These are chest-level design targets. Implementation may convert them to per-slot weights using:

`q = 1 - (1 - P) ** (1 / mean_slot_count)`

where P is desired probability of seeing at least one in the chest.

| Reward | Normal | Elite | Vault |
|---|---:|---:|---:|
| Mystery Fossil | 20% | 45% | 80% |
| Zombie stem cell | 12% | 35% | 70% |
| Enchanted Golden Food | 15% | 50% | 90% |
| Netherite Ingot | 1.5% | 15% | 40% |
| Deathnerite Ingot | 1% | 12% | 35% |
| Deathnerite Block | 0.05% | 1% | 3% |
| Enchanted Golden Apple | 0.5% | 5% | 15% |
| CD / Figure collectible | 2.5% | 8% | 20% |
| Warpstone | 0.75% | 1.5% | 4% |
| Blue Apple | 0.30% | 0.60% | 1.20% |
| Armor Trim template class | 0.30% | 1.5% | 4% |
| Netherite Upgrade template | 0.10% | 0.5% | 1.5% |
| Parcanite template | 0.03% | 0.15% | 0.5% |

Adjustments:
- Guard zombie stem cell target may be ~15%.
- Curse Enchanted Golden Food target may be ~20%.
- Heavy Netherite Ingot / Deathnerite Ingot may be ~4% each in normal Heavy.
- Mixed Deathnerite Ingot may be ~1.5%.

CDs and figures remain prestige collectibles and should not become filler.

Mystery Fossil is intentionally much easier to obtain than the other Collectible-class items.

Warpstone and Blue Apple stay approximately as rare as their corresponding normal-BSL tier rather than receiving a generic Infinite Castle boost.

Smithing templates are intentionally another rarity tier above most progression materials.

## 9. Deathnerite caveat

Current repository behavior for `true_dn:deathnerite_block` should be audited before treating the block as exactly nine Deathnerite Ingots of value. Its current recipe has previously been observed not to be a standard 9-ingot compression recipe.

Do not use a nonexistent active Deathnerite smithing template as a reward. Current Deathnerite progression uses `true_dn:deathnerite_ingot`; Parcanite uses `true_dn:darkness_upgrade_smithing_template`.

## 10. Validation before deployment

Normal BSL:
- all non-Special chest JSON parses
- Special 3 hashes/content unchanged
- profile draw ranges correct
- old independent rare probabilities preserved
- no `waystone:waystone`
- nested loot references resolve
- custom IDs resolve
- representative Early/Mid/High/End simulations

Infinite Castle:
- V4 receipt migration does not refill V2/V3 stocked chests
- exact distinct selected slot count within range
- no guaranteed-anchor behavior remains
- each selected slot receives one non-empty draw
- repeated same item stays in its assigned distinct physical slot
- restart during reward generation does not duplicate/re-roll ambiguous slots
- 10k+ simulation for occupied-slot distribution and rare probabilities

Game test:
- native normal structure chest filling may merge/split stacks; inspect actual physical occupancy
- verify potion `set_potion` output for normal/splash/lingering forms
- verify all custom items render/use correctly
