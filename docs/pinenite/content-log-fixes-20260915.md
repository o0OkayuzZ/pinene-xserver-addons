# ContentLog fixes — 2026-09-15

The 22:18 client session reported 77 errors. This update addresses the malformed
Molang scopes, resource/schema failures, and missing Mycology assets in the shared
development RP. The separate `normal` block sound informational messages remain.

## Changes

- Join split Molang blocks in 11 compatibility entities. Each `pre_animation`
  entry is parsed independently; the original statements and order are retained.
  The outline generator now performs the same normalization and rejects unclosed
  scopes.
- Keep sulfur cube's native `1.26.0` client format so `held_item_scale` and
  `hide_held_items` are accepted. Other compatibility entities retain their
  existing format.
- Give the invisible repair vault a valid render controller and empty geometry
  instead of an invalid empty controller list.
- Explicitly supply the vanilla `normal` block sound mapping in the outline RP
  without changing the logging level. The fresh client log shows this does not
  eliminate the informational lookup messages; their cause is still unresolved.
- Redirect the missing monstrosity reload sound to its bundled
  `sounds/mobNew/redstone_monstrosity/melee_charge.ogg`. The missing original
  recording is not available; this is a replacement sound.
- Remove unsupported `midtonesMax` from seven color grading files and reduce
  the overworld `highlightsMin` from 28 to its supported maximum of 20.
- Remove the dragon relic's legacy `blocks.json` texture override. Its existing
  BP geometry/material and block sound remain in use.
- Merge all 36 Mycology icon entries into the shared development RP and copy
  the corresponding icon, appraiser, and particle assets. Other atlas entries
  are preserved. This copy had the same RP UUID as the embedded world pack,
  but lacked the assets, despite reporting version 1.0.59.

The unidentified `geometry.pn_outline_default` message may have been a consequence
of the missing appraiser base model. All source outline aliases resolve statically;
the message has not recurred in the observed fresh client session.
The unused `pinene:waystone_menu` registration warning is unrelated to these
failures and is retained; castle diagnostic messages are also retained.

## Validation and rollout

- `npm test`: 278 tests passed, including six additional regression tests.
- Existing compatibility, sword, castle recovery, and item tests remain enabled.
- All five rollout plans passed JSON, import, version, and active dependency
  checks before installation. File hashes are checked before and after writes.
- Shared atlas validation confirms 36 resolving PNG references and preservation
  of every unrelated entry.
- After the user's Minecraft restart, `ContentLog2026-09-15_23-05-52_1.txt`
  contains zero errors during the observed startup/world session. The previous
  session contained 77. `normal` sound informational messages still recur.
- Minecraft reformatted the development world's two registration JSON files
  after installation. Their parsed contents, including every version, match the
  release plan exactly; no corrective rewrite was needed.
- Deployment applies only changed files, merges target-specific metadata,
  preserves shared pack versions used by other worlds, and backs up overwritten
  files. The server installer requires zero online players and backs up the
  stopped world before restarting the service.
- See [deployment evidence](content-log-fixes-20260915-evidence/results.json)
  for final target results. Sword swing quality and encounter gameplay are not
  established by the automated tests or by a clean content log.

Schema references: [official Bedrock schemas package](https://www.npmjs.com/package/@minecraft/bedrock-schemas)
(`1.26.20-beta.21`, `midtones.schema.json` and `highlights.schema.json`), and the
installed vanilla 26.45 sulfur cube and sound definitions. The sulfur cube
definition comes from `vanilla_1.26.30/entity/sulfur_cube.entity.json`.
