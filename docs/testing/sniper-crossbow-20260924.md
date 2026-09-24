# Sniper crossbow presentation and real-client verification

Date: 2026-09-24 23:56 through 2026-09-25 00:04 JST.
Environment: Windows Bedrock 26.51, full existing add-on stack in the disposable
`Pinene_Crossbow_RealTest_20260924` copy; not Xserver or the original development world.

## What was corrected

The old attachables referenced a shared geometry whose texture meshes used
`bow_standby` aliases absent from the new attachables. Replacing only the image
path could not fix that binding. The sniper families now have namespaced
geometry, animations, and render controllers, based on Mojang's crossbow sample,
with every mesh texture alias defined. Native charged state selects the loaded
arrow model; item-use state selects the drawing frames.

The original brown vanilla textures are explicitly bundled under a dedicated
path rather than depending on another pack's fallback. TNT variants keep their
existing per-depth textures. The circular scope retains a central reticle.
Existing FOV=30 and non-empty clear-marker lifecycle fixes are preserved.

## Actual runtime checks

The client was fully closed and reopened to load the item/RP changes. A prior
`/reload`-only test had still observed 44-tick use duration; that was NOT proof
of the new 25-tick configuration. This run observed 25 in all eight items.

| Item | Native use duration (ticks) | Direct damage, normal / scoped | Result |
|---|---:|---:|---|
| pinene:sniper_crossbow | 25 | 14 / 14 | PASS |
| pinene:sniper_crossbow_awakened_1 | 25 | 18 / 18 | PASS |
| pinene:sniper_crossbow_awakened_2 | 25 | 22 / 22 | PASS |
| pinene:sniper_crossbow_awakened_3 | 25 | 26 / 26 | PASS |
| pinene:sniper_tnt_crossbow | 25 | 10 / 10 | PASS |
| pinene:sniper_tnt_crossbow_awakened_1 | 25 | 13 / 13 | PASS |
| pinene:sniper_tnt_crossbow_awakened_2 | 25 | 16 / 16 | PASS |
| pinene:sniper_tnt_crossbow_awakened_3 | 25 | 19 / 19 | PASS |

Each item was loaded using a 1.50-second physical use-button hold, released,
and fired by a new click. Each was fired once normally and once while sneaking.
Charged state, projectile creation, damage, ammunition and durability changes,
and post-scope HUD state were recorded. TNT depth 1 was repeated because the
first run's final INSPECT command was not captured; the repeat passed.

Screenshots independently confirm held-model visibility, distinct empty/loaded
frames for all eight items, the central scope reticle, release-to-exit, and
slot-switch exit. A loaded plain crossbow also retained its charge through a
slot switch and fired for 14 damage with one arrow and one durability consumed.
Partial-charge cancel and no-ammo attempts did not create projectiles or consume durability.
The no-ammo use still raised itemCompleteUse; that event alone is not proof of loading.
The TNT depth-3 terrain test recorded 8 impacted blocks and zero fire blocks
in a 4,180-block scan.

## Reproducibility and rollout boundary

- Evidence: `C:/Temp/pinene-sniper-test-20260924/repair-v3/` on the test PC.
- Structured results: `matrix-results.json`, `matrix-events.json`, `safety-events.json`.
- Visual evidence: `hand-contact.png`; the `v3-*` screenshots in the parent folder.
- Content-log GUI was disabled locally, while file logging remained enabled.
- Diagnostic code is test-world-only and is not included in this source change.
- Run `python tools/validate_sniper_presentation.py` from the repository root.
- Pack release-version reconciliation remains part of main/deployment integration.
- No main merge, original-world update, or Xserver deployment was performed.

## Upstream asset attribution

Mojang bedrock-samples: attachables/crossbow.entity.json,
models/entity/crossbow.geo.json, animations/crossbow.animation.json,
render_controllers/crossbow.render_controllers.json, and crossbow item textures.
See the copied MOJANG_SAMPLE_LICENSE.md in this resource pack.
