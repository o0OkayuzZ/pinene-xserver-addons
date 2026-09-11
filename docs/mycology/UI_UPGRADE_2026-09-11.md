# Mycology rarity UI upgrade — 2026-09-11

Based on default branch commit `8d98749d` and `Mycology_UI_Upgrade_for_Codex.zip`.

## Changes

- `tools/mycology/pack/BP/scripts/mycology/ui.js`: supplied rarity palette, colored encyclopedia/detail, highest-rarity banner, NEW count, before/after progress and bar, MAX STACK labels, exact next first-stack count, and return-to-menu when no stack remains. Added a final formatting reset to the supplied error message.
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/mycology/ui.js`: byte-identical synchronized runtime copy. Integration documentation prescribes copying script files; asset builders do not synchronize this script.
- `tools/mycology/tests/ui.test.mjs`: eight mocked-form regression tests using the real appraisal and progress modules.
- `tools/mycology/package.json`: includes UI tests in the normal test command.
- This verification record.

## Verification

- Existing tests: 32 passed (15 core, 15 adapters, 2 portable guide).
- UI tests: 8 passed: 1/37/64 items, committed delivery before form, NEW/no-NEW progress, no-next-stack return, next first stack of 12/64 with another stack present, unknown-entry privacy, all ten rarity colors in list/detail with resets, mixed-rarity descending results and legendary banner.
- TypeScript check: passed.
- Existing exhaustive ticket tests preserve red total 2899 and brown total 3183, including the rarest boundaries. Probability data, core.js, appraisal.js, registry, discovery, NPC and recovery implementations are unchanged.
- Canonical and integrated UI files: SHA-256 equality verified.
- Git whitespace check: passed.

## Bedrock visual verification

These tests capture ActionFormData strings and navigation using mocks; they do not render Bedrock. No new in-game screenshots were taken. Actual font rendering of the supplied flame/star/progress glyphs, line wrapping, scrolling, contrast and device-dependent layout still require an in-game check. Existing ActionFormData and icons are retained; no custom JSON UI or timed effects are added. This change updates GitHub code only; it does not deploy to Xserver.
