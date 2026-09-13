# Zombie Gear v4 HD Report

Status: implemented, validated with local tooling, applied to the two requested local worlds, and pushed.

## Scope

- Updated the existing Zombie Gear BP/RP to version 1.1.8.
- Preserved the latest core BP dependency at `2b9dbf4f-7f7a-4e97-9687-4864e4f6f501` version `1.0.68`.
- Updated `@minecraft/server` to `2.6.0` and the BP minimum engine version to `1.26.40`.
- Integrated the v4 HD armor assets from the handoff: 20 attachables, 20 geometries, 20 armor textures, 20 merged item icons, and one render controller.
- Replaced the zombie stem cell item texture with a 32x32 transparent icon derived from the supplied image. The final palette keeps the original silhouette, uses muted rotten red/olive tones, and adds restrained sacred gold highlights.
- Added the unique RP texture path `textures/items/zombiegear_v4_stem_cell` and mapped `zonbikansaibou`, `zombie_stem_cell`, and `pm_zombie_stem_cell` to it.

## Gameplay

- Revives now play a loud low zombie groan, loud heartbeat, and totem sound at the revive location, plus a short red camera fade for the revived player.

- Emergency revive fallback now also checks post-hurt and death events, so addon enemy lethal damage that bypasses the normal before-hurt route can still consume a stored revive and restore HP.
- Zombie stem cells now have max stack size 1.

- Zombie stem cell recipe now uses a TNT-like 3x3 shape: 4 totems on the four side centers and 5 rotten flesh in the corners plus center, outputting 1 zombie stem cell.

- Revive charges are stored per player in `zs_revives` from 0 to 4.
- Gear corruption stage is represented by item IDs: base, `_c1`, `_c2`, `_c3`, `_c4`.
- Revives consume one stored charge, advance all four equipped armor pieces by one corruption stage, and preserve item metadata such as durability, names, lore, enchantments, locks, keep-on-death, and dynamic properties.
- Full set grants HP 80 through owned health boost tracking, while partial gear keeps only base item stats.
- Full set death handling cancels lethal hits and the short post-revive knockback window, then applies queued HP damage directly.
- Combat scaling is centralized in `scripts/combat.js`. Corruption keeps its scripted physical damage scaling `[0%, 10%, 30%, 70%, 150%]`; the full-set Zombie Gear attack bonus now uses the native `strength` effect slot instead, adding +1 Strength level on top of any active Strength potion.
- Infection attack/defense modifiers, melee infection, decay, and milk clearing remain in `scripts/combat.js`.
- Zombie stem cell charge UI supports hold-sneak for 8 seconds, progress feedback, release cancellation, and completion-only zombie stem cell consumption. Normal item use no longer starts a charge.
- The charge item is `pinematerials:zonbikansaibou`; the earlier `minecraft:totem_of_undying` check was replaced so the crafted zombie stem cell can actually charge revives.
- Full Zombie Gear no longer blocks food use. Normal foods can be eaten for their item effects only: hunger and saturation are restored to the pre-eat values, and Zombie Gear no longer adds nausea or blindness after eating.
- Rotten flesh is the only food that directly heals HP for a full Zombie Gear wearer. Rotten flesh keeps its normal hunger/saturation recovery, does not apply nausea/blindness, heals 8 HP, and repairs Zombie Gear armor by 10%.
- Night natural healing remains a full-set Zombie Gear ability.
- Regeneration and instant health effects remain blocked for full Zombie Gear; absorption is allowed.

## Local Worlds Applied

Applied to both requested worlds:

- `8v9pvwiD6QQ=` / `開発用ワールド`
- `IC_Phase1_Fresh_20260911` / `IC Phase 1 - FRESH TEST 20260911`

Each world received the changed Zombie Gear pack files. The applied files were hash-checked against the publish worktree, and both world registrations now point to BP/RP version `1.1.8`.

Backup directory:

`_workspace/zombie_gear_v4_20260911/world_apply_backup_20260911_232025`

## Validation

- `node tools/zombie_gear_v4/test_gameplay.cjs`: 32 gameplay mock tests passed.
- `py -3.12 tools/zombie_gear_v4/validate_assets.py`: JSON, armor IDs, protections, icons, geometries, textures, first-person visibility, UUIDs, and registration versions passed.
- TypeScript `allowJs/checkJs` check passed against `@minecraft/server` 2.6.0 typings.

The engine smoke test was prepared previously, but an in-game run was not completed in this session. The remaining risk is the exact runtime ordering of native `beforeEvents.entityHurt` damage values versus armor, enchantments, resistance, and absorption.
