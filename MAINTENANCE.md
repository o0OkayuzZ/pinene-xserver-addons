# Resource pack maintenance

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
