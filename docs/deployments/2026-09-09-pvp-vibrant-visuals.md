# Pinene PvP Island: preserve Vibrant Visuals

Joining the full XServer pack stack changed the client's graphics mode to Fancy. Local comparison worlds narrowed the reproduction to RP20 (Pinene PvP Island) together with RP10 (the visual pack).

The user confirmed that comparison O, containing all 20 resource packs with only RP20's `capabilities: ["pbr"]` added, preserves the intended appearance. Adding only `metadata.product_type: "addon"` in comparison L did not resolve the problem; that unsuccessful change is not included.

## Change

- Add `capabilities: ["pbr"]` to RP20's manifest. Its existing minimum engine version, `[1, 26, 40]`, is retained.
- Increase RP20 header/module versions from `0.2.15` to `0.2.16` to distribute the updated manifest.
- Update BP17's existing RP20 dependency to `0.2.16`, and increase BP17 header/module versions to `0.2.16` for that dependency change.
- Update both root and actual-world resource/behavior registration files.
- Preserve production UUIDs, pack order, assets, gameplay, and existing dependency structure.

The observed fix is specific to RP20 in this stack. It does not establish that every resource pack requires a PBR declaration. The diagnostic worlds use isolated pack identities and omit BP dependencies; the successful O test covers all resource packs, not live server gameplay.

## Validation

- All 37 BP/RP manifest header, module, and UUID dependency versions agree with the four world registration files.
- Comparison O's 6,894 non-manifest asset files match the production source by SHA-256.
- Repository diff check passes with CRLF recognized as the existing line-ending convention.

Official reference: [Vibrant Visuals Resource Packs](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/vvresourcepacks?view=minecraft-bedrock-stable).

## XServer deployment

- Applied on 2026-09-09; server reported `Server started.` at 01:18:43 JST.
- Backup: `/opt/minecraft/server/_pinene_deploy_backups/20260909_011753` (world archive and affected files).
- Updated two pack manifests and the four registration files; no files deleted.
- Verified all 10,195 deployed pack files by SHA-256 and all four registration files against the intended release.
- Post-deployment check confirms the service is active/running, RP20 is `0.2.16` with `pbr`, and `disable-client-vibrant-visuals=false` remains active.
- Live-client visual confirmation after this restart is still pending; the user confirmed the local full-RP comparison before deployment.
