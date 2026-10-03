# Cooking rank: actionbar-only notice

User decision: keep native crafting UI; add option 1 only. Do not rename knives, add panels, change fonts, or reopen the screen.

## Behavior
- Successful knife placement: one native actionbar message, e.g. `現在ランク：II`.
- Valid native board-open interaction: schedule one message outside restricted execution, then recheck player, board and knife. The native interaction is not canceled or delayed.
- Successful knife retrieval: `現在ランク：未設定` rather than leaving the previous rank as a new notification.
- Rank uses existing limits: copper II, iron III, gold IV, diamond VI, netherite VII.
- Roman numerals use ordinary ASCII letters, rendered by Minecraft; no font files or resource-pack changes.
- No interval/polling, title popup, extra chat announcement, timed blank-message cleanup, or attempt to monopolize the actionbar.
- Display errors are isolated from native crafting and successful item transfers.

## Scope and verification
- Updated only `native_boards.js` in the existing world `料理UI試験場（ナイフ連携）`; backup recorded in RANK_ACTIONBAR_STATUS.json.
- Source/test changes are on `feat/cooking-native-knife-phase1`. Main and Xserver unchanged.
- Python regressions: 24 passed. JavaScript mock tests: 32 passed, including 12 new notice cases. No skips.
- Complete script typechecks against the existing published @minecraft/server 2.7.0 definitions. The installed OnScreenDisplay declaration defines setActionBar as HUD text above the hotbar and disallows restricted execution; opening notices therefore use system.run.
- Other inspected world/shared-pack files: 537 unchanged. No world database, recipe, knife-stat, item-name or UI changes.
- The user previously confirmed the 34 recipes and native rank restriction in the earlier phase-one build. This does not verify the new actionbar rendering.

## Runtime check still required
Save and leave the world, then enter the same world again; no new world or pack import is required. Place a knife to check the notice, retrieve it to check the unset notice, then place another material.
This is a short-lived normal HUD notification, not a permanent label inside the crafting screen. Visibility while a native container overlays the HUD is not guaranteed or verified. No delay or forced close/reopen is added to make the message visible.
Actual in-game rendering, native font appearance and interaction timing of this notice remain unverified. No input was sent to Minecraft during this patch.
