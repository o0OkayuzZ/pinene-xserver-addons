# Bedrock pack ownership

This repository keeps large features in one canonical BP/RP pair where possible. Compatibility references may cross packs, but the same implementation payload should not be copied into several active packs.

Established owners after the 2026-09-21 cleanup:

- **PineCD:** BP04 `[音楽] ピネCDアイテム BP` + RP01 `[音楽] ピネCD音源 RP`.
- **Shared item textures:** RP01 owns `onso`; RP14 owns `pancake_kiji`. RP02 declares dependencies on both and retains the distinct `myname:onso` behavior/localization references. RP07 owns the zombie armor icons and its atlas now resolves them within RP07. `tools/shared_texture_ownership.json` records the exact atlas/path contract.
- **More Geodes:** BP07 `[鉱石] モアジオード BP` + RP04 `[鉱石] モアジオード RP`.
- **Gapple Cows:** BP02 `[モブ] ギャップルカウズ BP` + RP08 `[モブ] ギャップルカウズ RP`.
- **Blue Apples:** BP03 `[保守] 青リンゴ状態リセット BP` + RP16 `[保守] 青リンゴ状態リセット RP` own both the current `resetapple:*` definitions and compatibility definitions for the legacy `myname:*` blue-apple IDs.
- **System Crossbow:** active resource ownership is consolidated into RP07 `[装備互換] ゾンビ装備＋クロスボウ RP`. The former RP09 source pack had no unique active paths and is no longer registered; historical evidence remains in Git/docs.
- **PvP Island:** BP17 + RP20 own both the current `pinene_pvp:*` implementation and compatibility definitions for the legacy `pinen:tenrai_wedge` / `pinen:shingan_arrow` IDs. BP15/RP02 no longer own PvP implementation payloads.
- **Deathnerite / Parcanite:** BP05 owns behavior; RP06 owns the shared rendering payload (textures, models, attachables and animations). RP15 owns the Deathnerite atlas, blocks and localization metadata and explicitly depends on RP06. RP02 also declares its RP06 dependency and no longer duplicates the 65 Deathnerite/Parcanite rendering files. `tools/deathnerite_ownership.json` records the migrated paths; CI checks both their owner and all 35 RP15 atlas texture paths.

The CI audit rejects PineCD files outside its canonical packs, known files copied back into integrated BP15, editor/OS backup files in active packs, and large regressions in byte-identical cross-pack payloads.

Do not place historical backups inside an active pack directory. Git history is the backup.
