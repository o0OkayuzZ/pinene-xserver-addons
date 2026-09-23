# GF Card Cases v0.2 implementation report

> Historical local implementation report. Versions, two-case item names, placeholder textures and pre-integration validation below describe the earlier local stage only. The current four-case integration and validation are documented in [four-case-integration.md](four-case-integration.md).

Base: `67a5706bb79e951ddf975eebe24da6a2a7867eb4` (fetched main).
Branch: `feat/gf-card-cases-v0.2`; isolated worktree: `_workspace/gf-card-cases`.
No commit, push, PR, deployment, or live-world operation was performed.

## Architecture before / after

| Area | Before | After |
| --- | --- | --- |
| Player input | Debug menu | Two reusable case items plus retained debug menu |
| Action routing | UI directly invokes combat | UI-independent CaseActions shared by case/debug forms |
| Stale forms | Limited UI checks | Shared form lock; session, dimension and persisted-state snapshots |
| Recovery | Spawn plus every-20-tick all-player load | Spawn/dimension events, one-time startup/reload recovery, explicit operations |
| Core/storage | GF v0.1 | Same core files and v1 keys/formats; existing resolving recovery |
| Textures | Existing RP02 atlas | Shared meitetsu_chest placeholder; no new PNG or RP change |

At nominal 20 TPS, the removed loop performed 60 all-player enumerations per minute
(3,600 per hour), plus up to 60 deck loads per active player per minute.
The replacement has zero periodic player enumerations/deck loads while idle.
Startup/reload enumerates online players once; events and explicit operations still load as needed.

BP15: 1.0.78 -> 1.0.79. Modules, both world registrations, website registry and
BP09's dependency reference are synchronized. BP09 gameplay is unchanged.
RP02 remains 1.0.66. BP16, BP17, GF core, PineCD and other gameplay modules are unchanged.
Existing auto-repair and PineCD worktrees were checked against saved file-list/SHA256 snapshots:
19 and 23 pending files respectively remain unchanged.

## Validation

- `npm.cmd run test:gf`: 57 passed, 0 failed (existing release 4, cases/core 37, runtime 16).
- `python -B -X utf8 -m unittest discover -s tools/tests -p 'test_*.py' -v`: 4 passed.
- `python -B -X utf8 tools/audit_pack_ownership.py`: passed (34 packs).
- `git diff --check`: passed.
- Actual GF entry/module graph tested using mocked Minecraft APIs; this is not an engine smoke test.
- Stable @minecraft/server 2.7.0 type declarations checked for the events/component API in use.
- No full unrelated-addon test suite or real Minecraft test was run.

Tests cover case definitions/atlas, nonconsumption, 5-card display, selected-slot replacement,
missing-target no-write behavior, stale/cancelled selections, manual/automatic defense order,
reusable fixed attacks, capacity checks, persisted state/recovery, dimension/reload handling,
duplicate subscriptions, recursion protection and full/partially-filled inventory grants.

## Remaining engine/manual checks

Use an approved isolated test world; do not switch or modify the currently running world.
Verify case custom-component registration and Content Log, desktop/touch/controller item use,
placeholder rendering, form behavior, real targeting/damage/manual-auto defense,
full-inventory grants, dimension leave/reentry, disconnect/reconnect and script/server reload.
The GF README contains the detailed checklist and command examples.
Production card/case art, final card balancing, acquisition and dungeon rewards remain pending.

## Changed files

- `.github/workflows/gf-tests.yml`
- `README.md`
- `behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/manifest.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/items/gf_fixed_case.item.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/items/gf_random_case.item.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/manifest.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/README.md`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/Runtime.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cases/CaseItems.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/index.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CardMenu.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseActions.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseMenu.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/FormSessions.js`
- `docs/gf/card-cases-v0.2.md`
- `package.json`
- `tests/gf-cases.test.mjs`
- `tests/gf-fixture.mjs`
- `tests/gf-runtime.test.mjs`
- `website/src/data/pack-registry.json`
- `world_behavior_packs.json`
- `worlds/Bedrock level/world_behavior_packs.json`
