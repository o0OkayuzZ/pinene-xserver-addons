# Vanilla glass appearance and connected trap glass

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
