# Resource pack maintenance

## 2026-09-19: Separate the rendering pack

Moved `[描画] Vibrant Visuals・Deferred RP` (UUID `917aab9c-5273-1000-ba5e-087a4328aa6b`) out of the integrated addon set. It is now maintained independently as `Pinene_Visuals_RP` with header and module version `1.3.32`. The independent copy preserves the original `09ee3dc5` visual assets and settings, with current-engine compatibility for PBR scope, global water placement, explicit biome lighting, and namespaced `1.21.120` client-biome definitions.

Removed RP10 from both active repository registration files and from the current pack table. Historical deployment evidence and `snapshot-files.json` remain unchanged because they describe earlier snapshots in which RP10 was integrated. The live world's registration remains separate from this repository and must match the independent manifest version.

All active resource packs that provide a global `materials/entity.material` catalog must declare the `pbr` capability. `Pinenite Model Outlines` 1.0.6 and `[墓] 死亡回収・墓 RP` 1.0.9 now do so. An isolated pack-stack test also proved that `[音楽] ピネCD音源 RP` 1.0.30 independently disabled deferred rendering until it declared `pbr`; this is fixed in 1.0.31. Their dependent behavior packs and active registrations were versioned together. Omitting these capabilities makes the full world fall back from the deferred/PBR renderer even when `Pinene_Visuals_RP` itself is valid.

## 2026-09-08: Waystone Portuguese text

Restored 117 corrupted values in `resource_packs/rp_12_4d6ce949-1de7-41ec-87ab-3068434459a4/texts/pt_BR.lang`, including Portuguese accents and the section sign used by formatting codes. The previous audit's 116-line heuristic missed one additional recoverable value. Each changed value was reversed from the mistaken CP932 interpretation of UTF-8 bytes and verified by a lossless round trip. Translation keys, placeholders, line endings, and all other languages are preserved.

Versions: Waystone BP 8.2.5 → 8.2.6; RP 8.2.7 → 8.2.8. The BP version also changes because its existing RP dependency changes. Both manifests, their existing reciprocal dependencies, and both copies of the world BP/RP registrations were updated together. UUIDs and pack order are preserved.

Validation: reversible conversion of every changed value; unchanged translation keys; all 33 header/module versions and UUID dependencies consistent; root/world registration copies identical. In-game rendering has not been tested; GitHub publication does not deploy the server files.

`snapshot-files.json` remains the hash inventory of the original 2026-09-07 server snapshot at commit `09ee3dc`; it is not an inventory of the maintained files. README version rows describe the current repository versions.

## 2026-09-08: Remove INAKA's empty HUD override

Removed `resource_packs/rp_17_9a12d1e1-d6c3-43b6-8551-cdc1bb582f82/ui/hud_screen.json`. Its entire definition was `namespace: hud` and `root_panel.modifications: []`: it declared no furniture controls or modifications. Repository-wide reference searches found no custom reference depending on this file or on `hud.root_panel`. The standard HUD remains responsible for that element. This removes one unnecessary participant in the shared HUD path; it does not prove that all reported HUD differences are fixed.

Versions: INAKA BP 1.1.4 → 1.1.5; RP 1.1.5 → 1.1.6. Existing reciprocal dependencies and both root/world registration copies are synchronized. UUIDs, registration order, furniture definitions, Dungeons HUD/font, and the rendering RP's HUD are preserved. Validation: the removed file was checked against the exact empty definition; all 33 manifests and all four registration files pass consistency checks. In-game regression checks are still needed.

When applying this commit to an existing server directory, delete the removed INAKA HUD file as well as uploading changed files. Copying only new/modified files leaves the old override behind. Neither commit has been deployed to XServer by this maintenance session.

Remaining investigations: determine the intended appearance before changing the differing shared CD/apple/fossil images; reproduce Dungeons/rendering HUD interactions on clients. Glyph pages E2 and E7 do not collide, the grave `config` alias currently has no duplicate, and the arrow images resolve to identical pixels. These assets were not changed. Key fixes remain separate.
