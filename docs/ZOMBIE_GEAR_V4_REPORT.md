# Zombie Gear v4 HD Report

Status: implemented, validated with local tooling, applied to the two requested local worlds, and ready for push.

## Scope

- Updated the existing Zombie Gear BP/RP to version 1.1.0.
- Preserved the latest core BP dependency at `2b9dbf4f-7f7a-4e97-9687-4864e4f6f501` version `1.0.66`.
- Updated `@minecraft/server` to `2.6.0` and the BP minimum engine version to `1.26.40`.
- Integrated the v4 HD armor assets from the handoff: 20 attachables, 20 geometries, 20 armor textures, 20 merged item icons, and one render controller.
- Replaced the zombie stem cell item texture with a 32x32 transparent icon derived from the supplied image. The final palette keeps the original silhouette, uses muted rotten red/olive tones, and adds restrained sacred gold highlights.
- Added the unique RP texture path `textures/items/zombiegear_v4_stem_cell` and mapped `zonbikansaibou`, `zombie_stem_cell`, and `pm_zombie_stem_cell` to it.

## Gameplay

- Revive charges are stored per player in `zs_revives` from 0 to 4.
- Gear corruption stage is represented by item IDs: base, `_c1`, `_c2`, `_c3`, `_c4`.
- Revives consume one stored charge, advance all four equipped armor pieces by one corruption stage, and preserve item metadata such as durability, names, lore, enchantments, locks, keep-on-death, and dynamic properties.
- Full set grants HP 80 through owned health boost tracking, while partial gear keeps only base item stats.
- Full set death handling cancels lethal hits and the short post-revive knockback window, then applies queued HP damage directly.
- Combat scaling is centralized in `scripts/combat.js` with corruption multipliers `[1, 1.1, 1.3, 1.7, 2.5]`, infection attack/defense modifiers, melee infection, decay, and milk clearing.
- Totem charge UI now supports hold-sneak for 8 seconds, progress feedback, release cancellation, and completion-only totem consumption.

## Local Worlds Applied

Applied to both requested worlds:

- `8v9pvwiD6QQ=` / `開発用ワールド`
- `IC_Phase1_Fresh_20260911` / `IC Phase 1 - FRESH TEST 20260911`

Each world received 109 changed Zombie Gear pack files. The applied files were hash-checked against the publish worktree, and both world registrations now point to BP/RP version `1.1.0`.

Backup directory:

`_workspace/zombie_gear_v4_20260911/world_apply_backup_20260911_232025`

## Validation

- `node tools/zombie_gear_v4/test_gameplay.cjs`: 24 gameplay mock tests passed.
- `py -3.12 tools/zombie_gear_v4/validate_assets.py`: JSON, armor IDs, protections, icons, geometries, textures, first-person visibility, UUIDs, and registration versions passed.
- TypeScript `allowJs/checkJs` check passed against `@minecraft/server` 2.6.0 typings.

The engine smoke test was prepared previously, but an in-game run was not completed in this session. The remaining risk is the exact runtime ordering of native `beforeEvents.entityHurt` damage values versus armor, enchantments, resistance, and absorption.
