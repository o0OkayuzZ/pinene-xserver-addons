# BP17 region repair / Lost & Found

Base: `0e9b532b927e8a596f7c2afcc09fc28692a6e040` (`main`). Branch: `feat/pinene-auto-repair-lost-found`.

This is a new BP17 feature, imported once through `scripts/main.js` → `pvp_island/repair_service.js`. All gameplay handlers are gated to `pinene_pvp:pvp_island`. BP16 and all RP assets are unchanged. BP17 is bumped from 0.2.26 to 0.2.27, with matching world registrations, README and website pack registry. Rebased onto current main for PR review. Deployment and engine smoke remain deferred.

## Behavior

For player breaks and explosion block impacts, the native block-breaking/drop pipeline is cancelled. A shared bounded worker replaces eligible blocks with air. Natural block permutations (type, all states, waterlogging) are durably recorded first. The resulting hole remains visible while players are nearby. Protected blocks retain their existing protection/editor behavior; the Lost & Found gateway cannot be broken.

Defaults live in `pvp_island/config.js` → `AUTO_REPAIR`:

| Setting | Default |
| --- | --- |
| Region | 32×32, all heights |
| Nearby | 48 blocks horizontally from the region rectangle |
| Presence observation | Every 300 ticks / nominal 15 seconds |
| Absence required | 600,000 milliseconds / 10 minutes |
| Restoration budget | 24 attempted blocks per tick, globally |
| Destruction worker | 24 blocks per tick, globally |
| Destruction queue limit | 4,096 requests; excess blocks remain intact |

The first observation of no nearby players starts the full absence period. This intentionally starts up to one polling interval later than the actual departure, never earlier. A nearby player resets the clock. Restart conservatively starts a new grace period, because offline time cannot prove player absence. Ordinary polling only iterates dirty regions. It does not scan the island. When there is no dirty state, no player lookup or block lookup is performed for restoration.

While restoration is active, a shared worker builds a spatial player index and checks active regions every tick; a returning player pauses the region before writes. Player-occupied cells are indexed once per tick, so collision rejection is a set lookup, not a player×block loop. Failed, occupied and unloaded block attempts count against the 24-attempt budget. Those coordinates are retained and retried on a later region poll; the implementation does not force-load chunks. An unloaded region may therefore wait longer than ten minutes. Non-air replacement blocks and owned placements are never overwritten.

After-place events register the placing player's stable entity ID and return item. Destruction of tracked placements journals their return, removes them from the world and deletes ownership. Returns go to the placing player, regardless of who broke the block or whether the owner is online. Door/bed partner blocks share one returned item. Placement over a dirty natural coordinate preserves the underlying original permutation; once the placement is removed, the original natural terrain can later repair.

## Storage and recovery

`repair_store.js` uses BP17 world dynamic properties under `pinene_pvp:repair_v1:`. Each region has `lastPlayerNearbyAt`, `observedNearby` and `restorationState` (`waiting`, `restoring`, `clean`). Dirty blocks, placement ownership and return journals are stored in 4×4×4 subshards inside the region. A write serializes only the touched subshard or that region's metadata, never all dirty state. Runtime indexes are rebuilt once at world load.

Before writing air, original terrain or a pending return is saved. Restoring the same permutation twice is harmless, so a save failure after a world write leaves a retryable dirty entry. Pending placement removals remain unavailable for collection until removal completes. A pending container cannot be opened through player interaction. Shards are limited to 30,000 UTF-8 bytes to stay below the engine string limit. Corrupt data, a full shard or a storage failure pauses the service rather than silently dropping records. Pending entries and unclaimed mail consume that shard's capacity; claim mail regularly. Changing `regionSize` with existing saves requires explicit migration; changing proximity/time/budget does not.

The gateway never holds public inventory. Mail is private to the player interacting with it. Delivery preserves serialized type/count, name, lore, enchantments, durability, placement/destruction restrictions, item dynamic properties and lock/keep-on-death flags. Ordinary owned container contents are captured before removal and mailed separately. Full inventories leave leftovers in mail.

Inventory writes and world dynamic properties do not form an atomic transaction. A `delivering` marker is written before delivery. If the process is interrupted between those writes, the record is retained for administrator reconciliation instead of automatically duplicating an uncertain delivery. Review the recipient's inventory and explicitly record the delivered count with the command below. If a storage failure paused the service, resolve it and reload the test world before continuing. A hard crash before Minecraft persists its own world checkpoint cannot be made durable by Script API alone.

## Gateway and administrator commands

RP20's remaining `repair_vault` client definition references a geometry containing only a root bone and **zero cubes**, and BP17 has no entity definition for it. Static inspection therefore does not establish a reusable visible entity. The implemented fallback is a vanilla chest at configurable `AUTO_REPAIR.gateway` (default `2 65 0`). RP20 is not modified.

Inside the Pinene dimension, an operator runs:

```text
/scriptevent pinene_pvp:repair_gateway
/scriptevent pinene_pvp:repair_status
```

Installation refuses to overwrite an occupied coordinate. Interact with the registered chest to collect your own mail; collection is limited to 24 stacks per interaction. The operator-only `/scriptevent pinene_pvp:lost_found` invokes the same private collection path for the command's source player. The chest is a gateway, not a shared storage chest.

Interrupted-delivery investigation:

```text
/scriptevent pinene_pvp:repair_mail
/scriptevent pinene_pvp:repair_mail <owner-id>
/scriptevent pinene_pvp:repair_reconcile {"owner":"<owner-id>","shard":"<shard>","token":"<token>","deliveredAmount":0}
```

`deliveredAmount` must be the verified quantity already delivered from the first pending stack (0 to that stack's original count). Reconciliation does not deliver items itself. Unverified retries can duplicate items; unverified acknowledgements can lose them. These commands are operator script events, not an automatic recovery guess.

## Coverage and limits

- Ownership starts with placements observed after installation. Existing placed blocks cannot be distinguished from natural terrain without a prior ownership database.
- The controlled destruction routes are `playerBreakBlock` and explosion impacts. Raw `/setblock`, `/fill`, structure loads, unrelated scripts, fire/liquid/falling-block/support physics and piston moves do not provide the same cancellable event path and are **not claimed as covered**. Do not treat the feature as complete protection against arbitrary engine/world edits. In particular, physics-driven relocation can invalidate coordinate-based ownership and needs separate engine-backed handling before enabling those mechanics in a production arena.
- Native secondary drops from neighboring physics updates (including multi-block structures) require the deferred engine test. Mock tests cannot prove their absence. No broad item-entity deletion is used to hide this uncertainty.
- Unowned block entities with inventory or sign components are left intact, since a permutation cannot preserve their contents/text. Owned ordinary container contents are mailed separately. Containers holding known opaque-data items (nested shulker boxes, bundles, maps, written/writable books, potions, fireworks, banners and similar types listed in `repair_items.js`) are left intact, with a diagnostic, instead of silently losing that data. This is a conservative list, not a proof of lossless arbitrary/custom item NBT. Placed block items retain exposed item fields; opaque block-entity decoration data still needs engine-backed treatment before claiming full fidelity.
- Tool wear, native mining statistics and native break-event side effects are not emulated when the break is cancelled.

## Validation and deferred engine smoke

Run:

```text
node --test tools/tests/pvp_auto_repair.test.mjs tools/tests/pvp_repair_runtime.test.mjs tools/tests/pvp_compatibility.test.mjs
python -X utf8 -m unittest discover -s tools/tests -p "test_*.py" -v
python -X utf8 tools/audit_pack_ownership.py
git diff --check
```

Validation result: **51 JavaScript tests passed, 4 metadata tests passed, pack ownership audit passed, all 6 new modules passed syntax checks, and `git diff --check` passed**. Node 24.21.0 was used locally; CI uses Node 22. Detailed output: [test log](auto-repair-tests.log), [validation and changed-file list](auto-repair-validation.json).

The new tests run in the existing ownership CI workflow. They cover timing boundaries, return during repair, global budgets, negative coordinates, occupancy, unloaded retries, restart, shard isolation/failure, private offline-owner mail, partial inventory delivery, interrupted delivery, native-event cancellation, dimension gating, container journaling, multi-block ownership and the idle scheduler. Runtime tests use a mocked Bedrock API; they are not an engine smoke test.

**Engine smoke: NOT RUN.** The user explicitly requested that the currently open world remain untouched and that engine tests be deferred. No world switch, pack installation or test deployment was performed. The installed Minecraft window was inspected only; RP20 geometry was inspected statically. No claim of successful entity rendering, real drop suppression or live restart durability is made.

When isolated engine testing is authorized, use a new test world and copies of BP17/RP20, preserving the real server/world. Check:

1. Enter the custom dimension; create the chest gateway at a vacant coordinate. Confirm private interaction for two players, no public inventory opening, full-inventory retention, and no break/explosion removal of the gateway.
2. Break natural stone/logs in survival; confirm visible air and no native block/item/XP drop. Record orientation and waterlogging where applicable. Remain nearby for more than ten minutes; confirm the hole persists.
3. Leave beyond 48 blocks from the region bounds. Confirm no repair before a full 10 minutes after first absent observation. Confirm the 24-block budget and unloaded-coordinate retries.
4. Return during restoration (including teleport and another player); confirm pause and no player entombment.
5. Place/break blocks with a different player as breaker. Test offline owner return, door/bed halves and containers, plus support-dependent blocks, gravity, pistons, liquid and fire to identify uncovered native paths before production use.
6. Save/exit and reload with dirty regions, ownership and mail. Confirm original permutations and owner identities survive, with a fresh absence grace period. Exercise simulated interruption at each journal stage.
7. A future repair_vault test needs a test-only BP entity and visible geometry before it can supersede the chest. Summoning the current RP-only identifier is not proof that a BP entity exists. Keep the chest fallback until rendering, interaction and persistence are demonstrated.

API references used during implementation:

- [BlockPermutation](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockpermutation?view=minecraft-bedrock-stable)
- [ItemStack](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemstack?view=minecraft-bedrock-stable) (notably restricted-execution rules for `getCanPlaceOn` / `getCanDestroy`; serialization is deferred until the after-event phase)
- [Entity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)
