# 2026-09-13 Infinite Castle BSL V4 deployment

The new weighted-rebalance specification in Downloads had not been integrated in
the previous bulk release. This deployment implements its Infinite Castle section
only; normal structure BSL tables are unchanged.

Game source: `cec7d364e76523bbaffa0e3cf82b0878e33899be`.
BSL BP 1.0.18 / Infinite Castle BP 0.2.6. Every target received the same 34 pack
files and matching pack registrations. Full world backups preceded writes; save
data hashes were unchanged. Xserver was stopped with zero players and restarted
successfully, service active, new startup/content logs have no errors.

| Target | Save files preserved |
|---|---:|
| IC Phase 1 - FRESH TEST 20260911 (`IC_Phase1_Fresh_20260911`) | 8 |
| 開発用ワールド (`8v9pvwiD6QQ=`) | 13059 |
| Xserver (`Bedrock level`) | 440 |

New rewards occupy 16–20 distinct slots for normal encounters, 19–23 for Elite,
and 23–27 for treasure vaults. Existing claimed rewards are not refilled. V3
partial draws finish under V3 rules; unclaimed rewards use V4. Existing buildings,
player inventories, world databases and encounter progress were not reset.

Validation: 58 castle tests pass, 29 new tables / 32 reachable tables validated,
70,000 simulated reward chests and 30,000 slot-selection samples. Client gameplay,
native potion variants and visual inventory contents still require in-game checks.
Startup success is not a substitute for those checks.

See [implementation and limitations](../bsl/CASTLE_V4_UPDATE.md) and
[deployment results and backup locations](evidence/2026-09-13-castle-bsl-v4/deployment-result.json).
