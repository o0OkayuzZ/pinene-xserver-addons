# Approved ice-box jackpot: 27 reward-stack budget

Status: implemented and locally validated on the PR #20 branch; not merged or deployed.
This allocation supersedes all older ice-box numbers in the v2 design/history and PR description.
It does not certify the rest of PR #20 as release-ready.

## Approved allocation

| Group | Fixed reward stacks | Items in each stack | Total items |
|---|---:|---:|---:|
| Enchanted golden food | 16 | 3-6 | 48-96 (mean 72) |
| Golden food | 3 | 4-8 | 12-24 |
| Enchanted golden apple | 1, guaranteed | 2-4 | 2-4 |
| Pancake family | 2 | 2-4 | 4-8 |
| Resources or rare replacements | 3 | item-specific | 3 reward stacks |
| Packed ice | 1 | 8-16 | 8-16 |
| Snowballs | 1 | 8-16 | 8-16 |
| TOTAL | 27 | | |

The 16 enchanted-food draws select randomly from seven edible types: enchanted golden
bread, carrot, baked potato, beetroot, glistering melon slice, pumpkin pie and poisonous
potato. The existing golden/enchanted wheat entries are crafting ingredients, not edible
food, so this ice box alone excludes them. Shared food tables are unchanged.

## Rares replace resources; they never add an overflow stack

The three resource pools are independent. Their non-rare branch keeps the existing
resource weighting (diamond 10, emerald 10, gold block 8, experience bottle 8) and
quantities (8-20, 8-20, 2-6 and 12-32 respectively).

- Resource slot A: 30% existing collectible table; otherwise resources.
- Resource slot B: 4% warpstone; otherwise resources.
- Resource slot C: 1.2% blue apple; otherwise resources.

The common collectible 70/25/5 branches and their existing species weights are unchanged.
All three rares may occur together without displacing the 16 enchanted-food rewards.

## Implementation and capacity contract

Only `ancient_city_ice_box.json` is changed in the runtime packs by this patch. Quantities
are set on item entries in that chest; shared food and collectible tables are not edited.
There is no runtime refill code, tick scanning, teleport hook, or player-inventory mutation.
Existing claimed chest contents are not rewritten by this patch.

`tools/build_bsl_icebox_jackpot.py` is the reproducible generator. It reads existing food
rosters/weights but refuses conditional or otherwise unsupported source metadata.
`tools/validate_bsl_icebox_jackpot.py` recursively follows collectible references and
proves every branch emits exactly 27 nonempty stacks, each within its item stack limit.
Explicit item definitions take priority over their corresponding block-item fallback.

This is a generated-stack bound, not a Bedrock-engine or client-rendering emulator.
Native physical occupancy, actual generated item counts and rendering still require
an isolated Bedrock check. The large-chest dimension-change bug is outside this patch.

## Reproduction

```text
python -B -X utf8 tools/build_bsl_icebox_jackpot.py
python -B -X utf8 -m unittest discover -s tests -p test_bsl_icebox_jackpot.py -v
python -B -X utf8 tools/validate_bsl_icebox_jackpot.py --report docs/bsl/icebox-jackpot-validation.json
python -B -X utf8 tools/validate_bsl_weighted_rebalance.py
```

The full legacy validator delegates ice-box validation to the strict new contract.
Its success is NOT certification of all other v3 intent or native container capacity.

## Validation recorded for this patch

- 11 regression tests passed, including overflow, empty branches, food edibility,
  item stack limits, rare-probability drift, reference cycles and nested overflow.
- 10,000 full ice-box draws: exactly 27 generated stacks in every draw; zero capacity failures.
- Enchanted food observed mean: 72.0083; observed range 57-88; mathematical bounds 48-96.
- Legacy reference/preservation audit passed: 467 active tables, 421 references,
  57 Castle/common tables unchanged and 40,000 normal-profile draw simulations.
- Bedrock engine verification: NOT RUN. No production deployment.

## Remaining PR-wide blockers found during this check

The approved ice-box patch does not change these pre-existing issues at base `a1480cdb`:

1. Normal-profile increases described in the PR were not applied: the actual builder
   and chest files still use Early 13-17, Mid 14-18, High 14-19 and End 15-20.
   The legacy validator compares against these same constants, so its PASS does not
   verify the promised 15-19 / 16-20 / 17-22 / 18-23 ranges.
2. `bastion_treasure.json` has a diamond spear with weight 650 in the same one-roll
   pool as the supposedly guaranteed netherite-upgrade template (default weight 1).
   The template is therefore not guaranteed; the legacy check inspects only the
   first entry's name and misses the competing entry. Restore a truly dedicated pool
   and strengthen this assertion before treating the full PR as releasable.
3. Bastion Treasure and Buried Treasure still need their own native capacity and
   progression checks; the ice-box's 27-stack proof does not cover those tables.

The earlier claim that only a visual check remained for the full PR was too broad.
Do not merge/deploy this PR solely because the legacy validator and unrelated CI are green.

## Primary format references

- Microsoft Learn: loot-table pool rolls, entry weights and nested table semantics:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/loottablereference/examples/loottablecomponents/loot_table
- Microsoft Learn: item `set_count`:
  https://learn.microsoft.com/en-us/minecraft/creator/reference/content/loottablereference/examples/loottabledefinitions/itemmodtables
