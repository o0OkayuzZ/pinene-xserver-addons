# Mycology: cinematic appraisal and species sound design

The appraisal result now opens with a rolling charge, a small ascending selection of actual species, a highest-rarity reveal, and a species-specific musical ending. Default 64-stack sequences last **15–25 seconds at 20 ticks/second**. The summary still lists every result; the animation highlights at most four other species before the highest one.

- **35 distinct theme/motif combinations:** recovery/food uses bells and harp; harmful effects use bass and didgeridoo; buffs use bit and pling; unusual/specimen species use chime and flute; B06 uses xylophone and percussion. These categories describe game effects, not real-world edibility.
- Rising percussion and notes during the charge; deliberate pauses; richer endings at ★7–8 and separate ★9/★10 endings. Rarity steps never exceed the actual highest result.
- Sound is personal (`Player.playSound`), using existing vanilla assets. No resource pack assets or global audio are changed. Cue volume is at most 0.7, pitch at most 2. Existing client volume sliders still apply.
- Appraiser menu: **じっくり → 短縮 → OFF** and independent sound ON/OFF. Preferences persist per player using `pinene:myco_reveal_mode` and `pinene:myco_reveal_sound`.
- Sneak skips to the result. Short mode is about 3.3–5.5 seconds for 64 items. Timings use server ticks, so a lagging server can take longer.

## Transaction and cancellation

`appraise()` completes inventory delivery, discovery registration and receipt handling before the first animation await. No RNG, transaction, discovery, NPC validation, recovery or item data changed. The next-stack amount is read after the animation so it reflects inventory changes during the wait.

One outstanding timer per active reveal; validity, health, dimension and the exact session object are checked at most every two ticks. Disconnect/death/dimension change/replaced sessions stop subsequent cues and do not open stale forms. Cleanup does not delete a newer session lock. Sneak clears this reveal's title and goes to the summary. Only one-shot sounds are used; an already played note can finish its natural decay. Unavailable sound/display APIs fall back to visual-only or the result form, without rolling again.

## Files and verification

Canonical scripts `tools/mycology/pack/BP/scripts/mycology/`: updated `ui.js`; extracted unchanged rarity helpers into `rarity_ui.js`; added `reveal.js` and `reveal_sounds.js`. All four files are synchronized to the integrated BP's `scripts/mycology/` directory. The normal npm test command includes `tests/reveal.test.mjs`.

- **57 tests passed**: 40 existing, 17 new reveal tests.
- New tests include real appraisal delivery before the first timer; full/skip/missing screen/disconnect/new-session behavior; no re-rolls or orphan timers; muted/off modes; next-stack refresh; persisted menu preferences; all 35 species themes/motifs; 64-item duration bounds and positive full/short frame durations.
- TypeScript check passed against the existing `@minecraft/server 2.7.0` and `@minecraft/server-ui 2.0.0` types.
- Existing exhaustive ticket tests still pass: red 2899, brown 3183.
- Every sound identifier checked against [Mojang's vanilla sound definitions](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/sounds/sound_definitions.json). Player-only sound and title usage follow [Player](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player?view=minecraft-bedrock-stable) and [ScreenDisplay](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/screendisplay?view=minecraft-bedrock-stable); the installed stable types remain the compatibility reference.

No in-game screenshots or listening test were performed. Actual sound balance, font glyphs, title wrapping and coexistence with other addons' title/action-bar messages need an in-game check. Titles use the game's shared HUD channel, so another addon may overwrite them. Existing icons and ActionFormData result screens remain in use.
