# GF v0.3 four-case integration

Base: fetched `main` at `0f7d5acf6b1169e22eb71160a52b1d3febda674b`, after Auto Repair PR #18 merged. Branch: `feat/gf-card-cases-v0.2`.

## Case entry points

| Official item | Behavior |
| --- | --- |
| `pinene_gf:case_active_attack` | Attack cards filtered from the existing five-slot hand, fixedAttack, read-only attack details, Collection and deck builder |
| `pinene_gf:case_active_defense` | Defense cards filtered from the same hand; armManual retains the card until a compatible attack consumes/replenishes it; Collection and deck builder |
| `pinene_gf:case_auto_defense` | Ordered autoDefense list, maximum nine, defense priority, Collection and ownership-validating deck builder |
| `pinene_gf:case_auto_attack` | Only displays `自動攻撃システムは未実装です`; no battle load, automatic firing or periodic attack |

All four are reusable/nonconsumable and retain main's original 32×32 textures and atlas. No old Random/Fixed item definitions or placeholder texture dependency are added. Random Deck and fixedAttack remain internal data structures. Filtered UI selections map back to the original hand slot. The give_cases command grants only missing official cases, requiring enough empty slots before writing.

Existing Collection v1 persistence, combined owned-count checks across randomDeck/fixedAttack/autoDefense, maximum three per name, legacy configuration preservation, production-only Collection/builder choices, async Railgun reservations, reflection and combat feedback remain intact. No grant migration is added. Balance and all production card definitions are byte-equivalent (ignoring checkout line endings) to the preserved local implementation. Only three production cards exist, so a new legal sixteen-card deck is still impossible; existing loadouts are preserved and no filler cards or ownership bypass is introduced.

Damage Number continues to use actual entityHurt.damage, temporary labels, BLOCK/reflection, Railgun multiple targets, dummy suppression and stale-ticket cleanup. Target nameTags are untouched.

## Metadata

| Pack | main | This PR |
| --- | --- | --- |
| BP15 | 1.0.79 | 1.0.80 |
| RP02 | 1.0.67 | 1.0.68 |
| BP09 | 1.2.14 | 1.2.15 |
| RP07 | 1.2.15 | 1.2.16 |

Module versions, BP15→RP02, BP09→BP15 and BP09↔RP07 dependencies, both root/world registrations, README and website registry are synchronized. BP09/RP07 gameplay/assets are unchanged. The Crossbow tests' exact version expectations are updated for this dependency-only bump. BP16, BP17 Auto Repair and PineCD are unchanged.

Rebase/stash replay conflicts resolved in eight files: root README, BP09/BP15 manifests, GF README, package.json, website registry and both behavior registration files. Metadata was rebuilt from current main, and npm test retains Crossbow coverage while adding GF and Auto Repair suites.

## Validation

- Original local GF baseline: 139 passing tests.
- Four-case integration: 156 GF tests pass, none skipped. Existing ownership, combat feedback, async Railgun, reflection and v1 persistence coverage retained.
- Metadata regression: 4 tests pass; official four-case asset regression: 1 test passes.
- Pack ownership audit, current-main metadata consistency and syntax of all 36 GF JavaScript modules pass.
- Main's four textures/atlas and unrelated runtime files are preserved; saved local core logic is checked against the pre-rebase stash.
- Full `npm test` was executed. It reaches the Pinenite suite and has the same five pre-existing failures reproduced on a clean independent checkout of base main: entity-preservation baseline, relocated blue-apple recipes, figure tag-helper expectation, Crossbow-preservation baseline, and the removed duplicate RP02 parcanite icon. These unrelated runtime features were not changed to satisfy obsolete tests.
- `npm run validate` was executed. The working checkout first fails its historical release byte hashes due to CRLF. Independent LF main also fails the historical hash for BP02 `items/golden_food_guide.json`; the validator's baseline predates accepted changes. The staged GF candidate in the same LF snapshot fails on that same file. This command is not reported as passing.
- The Castle suite was run separately because npm's earlier failure prevents it from starting: 115 tests pass.

See `four-case-validation.json` for final counts and checks. Historical v0.2 / Phase 1 / Collection reports in this directory retain their original local-stage findings; this document supersedes their versions and case item/texture descriptions.

## Deferred engine checks

No deployment or live-world changes. In an isolated test world, confirm:

1. All four official case names/icons and keyboard/controller/touch use, nonconsumption, full-inventory grants and transfers without transferring ownership.
2. Attack hand filtering, fixed attacks, detail view, manual defense compatible/incompatible hits, ordered automatic defense and both priorities.
3. Collection owned/used counts, stale edits, legacy loadouts and save/relog/restart persistence without grant migration.
4. Production damage and balance, Railgun charge/cancellation/multiple targets, reflection, actual engine damage labels, BLOCK, ~25-tick despawn and Dungeons Target Dummy duplicate suppression.
5. Reserved auto attack only displays the unimplemented message, with no damage or periodic scheduling.
