# BSL weighted rebalance v2 — full release

BSL BP 1.0.19 completes the supplied weighted-rebalance v2 specification. Normal
structure loot now uses Early 13–17, Mid 14–18, High 14–19 and End 15–20 base
weighted draws, with reduced per-draw stack quantities. Independent rare pools
retain their exact entries, conditions and probabilities. Repeated items remain
possible. Native structure filling may merge or split stacks: these counts are
draw counts, not guaranteed occupied physical slots.

33 normal chest tables were converted. The three bespoke Special tables
(ancient-city ice box, bastion treasure, buried treasure) remain byte-equivalent
to the pre-rebalance release. The previously deployed Infinite Castle V4 tables
remain unchanged: 16–20 occupied slots normally, 19–23 for Elite, 23–27 for vaults.
Already-generated/claimed chest contents are not reset or refilled.

The supplied builder is imported with safe repeat execution: it always transforms
the fixed c60934c0 baseline and rejects unknown local edits. Re-running it cannot
quarter quantities repeatedly. Unsupported conditional pools are retained.

Validation covers all 475 active loot tables, 424 nested references, custom item
IDs, independent-pool equality, category weights, quartered counts, 33 new draw
ranges, three untouched Special tables, and 57 unchanged Castle/common tables.
40,000 normal-chest simulations pass. Castle's 70,000-chest validation also passes.
`validate_bsl_phase05.py` routes the current release to these audits while keeping
the historical ZIP audit code intact. Native visual fullness, generated item
metadata and potion output still need in-game acceptance testing.

Source: [supplied specification](weighted-rebalance-v2-source.md).
Evidence: [conversion audit](weighted-rebalance-v2.json),
[full validation](weighted-rebalance-v2-validation.json),
[Castle validation](castle-v4-validation.json).
