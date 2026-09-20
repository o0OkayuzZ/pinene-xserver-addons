# Bedrock pack ownership

This repository keeps large features in one canonical BP/RP pair where possible. Compatibility references may cross packs, but the same implementation payload should not be copied into several active packs.

Established owners after the 2026-09-21 cleanup:

- **PineCD:** BP04 `[音楽] ピネCDアイテム BP` + RP01 `[音楽] ピネCD音源 RP`.
- **More Geodes:** BP07 `[鉱石] モアジオード BP` + RP04 `[鉱石] モアジオード RP`.
- **Gapple Cows:** BP02 `[モブ] ギャップルカウズ BP` + RP08 `[モブ] ギャップルカウズ RP`.
- **PvP Island:** BP17 + RP20 are the current dedicated packs. Remaining mixed legacy definitions in the integrated packs require dependency-aware cleanup rather than blind deletion.
- **Deathnerite:** BP05 is the canonical behavior implementation. Resource ownership is still mixed with compatibility assets and must be separated carefully.

The CI audit rejects PineCD files outside its canonical packs, known files copied back into integrated BP15, editor/OS backup files in active packs, and large regressions in byte-identical cross-pack payloads.

Do not place historical backups inside an active pack directory. Git history is the backup.
