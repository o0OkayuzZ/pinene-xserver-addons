# 2026-09-13 full BSL weighted-rebalance deployment

BSL BP 1.0.19 completes the normal structure conversion from the supplied v2
specification. All 33 normal tables are rebalanced; the three bespoke Special
tables and previously deployed Castle V4 remain unchanged.

Game source: `e2577119d778901ad116d1cbd231b76058584db9`.
Every target received 34 changed pack files and matching registrations. The full
221 tracked game files in BSL and Infinite Castle were compared with the source.
Complete world backups preceded writes; save hashes remained unchanged.

| Target | Save files preserved |
|---|---:|
| IC Phase 1 - FRESH TEST 20260911 (`IC_Phase1_Fresh_20260911`) | 8 |
| 開発用ワールド (`8v9pvwiD6QQ=`) | 13059 |
| Xserver (`Bedrock level`) | 437 |

Xserver had zero online players before normal shutdown. After updating, its
service is active, startup completed, and new startup/content logs have no errors.
Existing generated chests, player inventories, structures and progression were
not reset or refilled.

Validation: 475 active loot tables, 424 references and active custom IDs checked;
33 draw ranges and reduced quantities checked; independent rare pools and three
Special tables preserved exactly; 57 Castle/common tables unchanged. Simulations
cover 40,000 normal chests and 70,000 Castle chests. Re-running the builder uses a
fixed source baseline, preserving repeatability without reducing quantities again.

Web: 53-file type check has zero errors/warnings/hints, build generates 1008
pages, output audit passes, publication tests 4/4 and release browser tests 6/6
pass. Public BSL and Castle reward guides now show the correct ranges and retain
the distinction between normal base draw counts and Castle physical slot counts.
Published site commit `f3ccd7ab2cce33a6d51226c668f55d4807d6d660` from source
`0b8eeb60`; [Pages deployment succeeded](https://github.com/o0OkayuzZ/pine-server/actions/runs/34763632881).
Six live page/viewport checks pass (390px and 1440px).

Native structure inventory merging/splitting, generated item metadata, Castle
potion outputs and in-game reward appearance remain client acceptance items.
Server startup and mocked tests do not certify those gameplay checks.

[Implementation](../bsl/WEIGHTED_REBALANCE_V2_UPDATE.md) ·
[Deployment evidence and backup paths](evidence/2026-09-13-bsl-weighted-v2/deployment-result.json) ·
[Live page checks](../../website/artifacts/bsl-weighted-v2/live-verification.json)
