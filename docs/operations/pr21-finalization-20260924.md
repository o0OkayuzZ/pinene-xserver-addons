# PR #21 finalization and figure runtime repair

Base main: `7a564e280be13954eb102279865b2ff05b37e86b` (BSL v3 already deployed).
Original PR #21: `ddf04ec5d7358f96d8ef1d1acdf03b19aff988c2`.

## Runtime repair

The figure death callback called `pineHasTag` without an active definition. The only old tag helper belonged to a commented-out raid prototype. A second dependency, `safeGetEntityLocation`, also had no active definition. Restored both helpers outside that comment and retained their exception-safe behavior. Nonfinite locations are rejected before passing values to the engine. Ordinary non-figure deaths return before tag access. The inactive raid prototype remains inactive.

Nine tests execute the real figure code in a VM with mocked engine ports: ordinary deaths, natural figure deaths, pickup followed by death, legacy aliases, missing/invalid entities, unavailable/nonfinite locations, tag exceptions and item-spawn exceptions. The previous tag-helper regression test is unchanged and now passes.

## Integrated work

The original appraiser lifecycle and PineCD guard implementation are retained. Natural appraisers may coexist; named natural individuals persist; natural-origin death rewards remain red/brown/crimson/warped fungi 64 each. Runtime/authoring parity is maintained. BP15 1.0.81, RP01 1.0.33, RP02 1.0.69, BP04 1.0.34, BP09 1.2.16, RP07 1.2.17 remain the planned release versions. BSL stays 1.0.23; BP17 stays 0.2.27.

Merged current main into the integration branch; resolved the README conflict by retaining current main and applying only the six planned version updates. Current BSL loot and its public guide, GF combat, Auto Repair, Crossbow gameplay, and BP16 are not modified.

## Verification and limits

- Figure tests: 9/9. Mycology: 109/109. GF: 156/156. Auto Repair/PvP: 51/51. Crossbows: 15/15.
- BSL: 22/22. Metadata/case assets: 5/5. PineCD cap tests: 4/4. Ownership audit, Mycology static checks and JavaScript syntax pass.
- Full npm test: 458/462 passed; four pre-existing Pinenite preservation/path tests remain failing. Clean current-main baseline: 419/424 passed, including the now-fixed missing-helper failure. No failing assertion was removed to obtain these results.
- Castle was run separately: 114/115 on both current main and this candidate. The remaining audit count failure also occurs after the BSL release on unmodified main. BP16 has not been changed.
- Gameplay acceptance remains unexecuted; the user requested proceeding without additional live gameplay tests. Startup and log monitoring are separate deployment checks, not gameplay acceptance.
- The dimension-change double-chest issue and unrelated full-repository validator failures are not claimed fixed.

Earlier parallel-integration reports are historical. Their statement that BSL PR #20 is pending is superseded: BSL is already merged and deployed. This report supersedes the old PR #21 release gate concerning the missing figure helper. Deployment results are recorded separately only after actual rollout.
