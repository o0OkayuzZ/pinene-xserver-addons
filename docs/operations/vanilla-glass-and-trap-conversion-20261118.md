# Vanilla glass appearance and connected trap glass

**Current status: rolled back at the user's request on 2026-11-18.** The user reported that the traps stopped working and the appearance was not as expected. The deployment and conversion below are historical, not the current production configuration. Saved connection masks and block counts did not establish farm compatibility or acceptable client rendering.

The user requested vanilla appearance for ordinary glass, then connected-glass replacement in the guardian farm and connected tinted glass in the creeper farm.

## Ordinary glass appearance

Production's independently managed rendering RP (UUID `917aab9c-5273-1000-ba5e-087a4328aa6b`) was updated from **1.3.46 to 1.3.47**. Its source assets are outside this repository's addon snapshot; `tools/build_vanilla_glass_restore.py` records the exact reproducible transformation and produces a hash-checked deployment archive without modifying its input tree.

- Remove 280 ordinary-glass image/PBR and separate carried-image overrides, allowing the client vanilla textures to resolve.
- Cover plain glass/panes, all 16 stained colors/panes, tinted glass and legacy stained-glass entries: 37 block definitions.
- Remove carried-texture overrides. Private atlas aliases reference vanilla texture paths so similarly named Waystone atlas entries cannot override ordinary colored glass.
- Preserve other rendering settings and every file in both connected-glass packs. No connected blocks, recipes, scripts or Waystones are removed.
- Update only this RP's root and world registration versions, preserving load order/subpack selection and all other records. The root reference had an older 1.3.37 version; the active world reference was 1.3.46.

Official vanilla mappings were checked against Mojang's [block definitions](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/blocks.json) and [terrain atlas](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/textures/terrain_texture.json). No vanilla images are bundled in this patch.

Production deployment completed at **2026-11-18 02:51 JST** with zero startup content errors. All 285 changed paths and the complete protected rendering/connected packs matched the planned hashes. All 765 world data files retained their size and modification time during pack application. The stale carried-texture reference scan found zero remaining references.

Backup directory: `/opt/minecraft/server/_pinene_deploy_backups/vanilla-glass-20261118-024924`. Its full offline world archive is 1,404,487,956 bytes and passed gzip integrity verification. Replaced/deleted files, deployment hashes and results are retained there. Release archive SHA-256: `84362a5875e42b13184f39a535fc82eeb7ace98faf4fd30c330b859c94cc5d66`.

## Trap replacement scope

The freshly backed-up world database was decoded read-only in a temporary copy. Previous repair records identified the two farms; current blocks determined the exact replacement bounds.

| Farm | Source | Destination | Count | Bounds (inclusive, overworld) |
| --- | --- | --- | ---: | --- |
| Guardian | `minecraft:glass` | `pinene:connected_glass` | 1,226 | (380, 62, 2727) to (436, 82, 2787) |
| Creeper | `minecraft:tinted_glass` | `pinene:connected_tinted_glass` | 2,460 | (456, 138, 2532) to (497, 152, 2573) |

The creeper farm's 317 ordinary glass blocks are outside the requested tinted-glass replacement. The connected tinted block retains light dampening 15. Saved glass positions have no non-air secondary block layer.

Changes use native `fill ... replace <exact source identifier>`, with each volume below 32,768 blocks, and require zero players. The guardian volumes are split at Y=62–70, 71–79 and 80–82, with expected counts 1,103, 111 and 12. The creeper wall is one volume. Existing ticking areas are at capacity; Area2 is temporarily repurposed and restored to (2160, 0, 112)–(2175, 0, 127), preload=false. The complete console record and before/after position records are retained beside the world backup.

## Final verification

The replacement completed and was independently verified from a consistent saved-world copy at **2026-11-18 03:05:04 JST**:

- All **3,686** recorded source positions contain the intended connected block; zero replacements are missing.
- Every block's saved horizontal/vertical connection mask matches its six actual neighbors: **zero mismatches**.
- The creeper farm's **317** ordinary glass blocks retain their original positions, identifiers and states. No glass coordinates were added or removed in either audited region.
- All changed full glass blocks retain an empty/air secondary layer.
- Area2's original bounds and preload=false are restored; the temporary ticking area is removed.
- World saving is resumed. Minecraft and the Xserver manager are active; current content errors are zero.

Evidence beside the backup: `trap-glass-before.json`, `trap-glass-after.json`, `trap-glass-console.log`, `trap-glass-result.json`, `trap-glass-after-save-manifest.json`, and `trap-glass-verification.json`. Rollback should use the recorded positions and check the expected connected identifier before restoring each original block, rather than overwriting the whole bounding box. The full offline world archive is also retained.

The builder passed a dry run against the captured source files, including the 37-definition scope and preservation assertions, and Python syntax validation. Server/structure checks do not establish the visual appearance in a player client.

## Rollback completed

Rollback was independently verified at **2026-11-18 03:15:33 JST**.

- Restored the guardian farm's **1,226** blocks to `minecraft:glass` and the creeper farm's **2,460** blocks to `minecraft:tinted_glass`.
- Generated 129 guardian and four creeper fill cuboids from the exact saved positions. Every cuboid contained only recorded targets; every command filtered for the expected connected identifier. No whole-world restore or bounding-box overwrite was performed.
- A fresh consistent saved-world copy confirms all **4,003** glass positions across both audited regions match their original identifiers and states, including the creeper farm's unaffected 317 ordinary glass blocks. No non-air secondary layer was introduced.
- Restored all **282** rendering asset/definition files byte-for-byte to their pre-experiment hashes. The manifest and the two references use **1.3.48** to refresh client caches; the appearance itself is the original 1.3.46 configuration.
- Both complete connected-glass packs remain unchanged, so pre-existing unrelated connected-glass builds remain supported.
- Restored Area2 and removed the temporary ticking area. Both services are active after restart, with zero content errors. Actual farm spawning/processing and client appearance have not been independently observed after rollback.
- Alylica's Dungeons remains at local deployment **2.1.6** (upstream 2.1.4). Other buildings, player progress and unrelated addons were not rolled back.

Rollback evidence in the original backup directory: `rollback-trap-plan.json`, `rollback-trap-console.log`, `rollback-trap-result.json`, `trap-glass-rollback.json`, and `rollback-verification.json`. The pack rollback has its own before-files and deployment plan at `/opt/minecraft/server/_pinene_deploy_backups/glass-rollback-20261118-031413`. The original complete world backup is retained; temporary database copies were removed after verification.
