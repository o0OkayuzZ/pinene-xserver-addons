# Infinite Castle BSL V4

The September 13 `BSL_weighted_rebalance_v2_spec.md` was present in Downloads but
was not included in the earlier 1.0.17 release. This change implements its Infinite
Castle section. It does not apply the separate normal-structure BSL conversion.

- BSL 1.0.18; Infinite Castle BP 0.2.6.
- Normal encounters: 16–20 distinct occupied reward slots; Elite: 19–23; vault: 23–27.
- Every selected slot uses the same non-empty weighted table. Identical items stay
  in separate physical slots. There is no special anchor slot in new rewards.
- Common food/materials, original Mycology species weights, themed potions and
  progression rewards follow the supplied specification. The fossil target is
  separate from collectibles so nested tables cannot increase its probability.
- Rare per-slot weights use the specified mean-slot conversion. Exact probabilities
  averaged over each slot-count range are recorded in `castle-v4-probabilities.json`.
- Potion forms are 50% normal / 35% splash / 15% lingering; effect weights vary by
  encounter. `set_potion` uses the [official potion function](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/loottablereference/examples/loottabledefinitions/enchantingtables?view=minecraft-bedrock-stable).
- Existing V2/V3/V4 stocked receipts remain final, including empty looted chests.
  A partial V3 receipt finishes using the unchanged V3 tables. New V4 receipts
  persist `selectedSlots`, the cursor, and pending index before native commands.
  The name `selectedSlots` avoids the existing actor-slot serialization filter.
- An ordinary failed command retries the same selected slot. A write followed by
  an exception is not repeated. After a restart, an ambiguous pending draw is
  skipped even when empty, because it may already have been collected. Thus a
  crash can leave a missing slot rather than duplicate rewards; normal completed
  draws fill exactly the selected count.
- No existing world chest, player inventory, or encounter ledger is reset.

Validation: all 58 castle tests pass; 29 generated tables / 32 reachable tables
have valid non-empty single-roll chains and resolved custom IDs. Seeded simulations
cover 70,000 chests and validate rare probabilities; slot selection covers another
30,000 chests. Native potion output and in-game reward appearance remain to be
verified. The tests use mocked native loot writes and do not certify engine loot
execution.

The Deathnerite block recipe currently uses nine Netherite upgrade templates,
not nine Deathnerite ingots. This existing recipe is retained; block value is not
treated as nine ingots.

Evidence: `castle-v4-validation.json`, `castle-v4-probabilities.json`, and the
preserved source `weighted-rebalance-v2-source.md`.
