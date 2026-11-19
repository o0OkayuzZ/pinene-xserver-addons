# Chili crop development QA — 2026-10-15

**Draft implementation. No real-world deployment or client verification performed.**

## Intended gameplay
- Obtain `pine:chili_pepper` as a rare Infinite Castle chest reward.
- The same pepper is a direct cooking ingredient and a plantable item; **no chili powder or chili oil intermediate items**.
- Only plant on `minecraft:farmland`. Use the custom cross-geometry crop block `pine:chili_crop`.
- Four ages (0–3), age 3 being harvest-ready. Regular tick interval: 1,200–2,400 game ticks, with a 40% chance to grow by one stage on each tick.
- Harvest by interacting when mature. Drops 2–4 peppers and regrows from age 1; no replant required.
- Bonemeal raises age by one; consumes one bonemeal in Survival but not in Creative.
- Breaking the crop uses a separate loot table (1 pepper).
- Chest slot table targets: normal special-chest categories ~2%, elite ~4%, treasure vault ~6% per applicable draw. These are **loot-table target probabilities**, not verified average odds per entire chest.

## Gameplay verification (development world only)

| ID | Steps | Expected |
| --- | --- | --- |
| CHILI-01 | Open eligible Infinite Castle loot, inspect records | Chili appears without replacing unrelated table structures |
| CHILI-02 | Plant pepper on prepared farmland | Crop block placed; pepper stack behaves normally |
| CHILI-03 | Attempt to plant pepper on stone/grass | No invalid crop placement |
| CHILI-04 | Observe age changes or use test commands | Four visual stages, no broken alpha or missing texture |
| CHILI-05 | Interact with mature plant multiple times rapidly | Exactly one harvest, 2–4 peppers |
| CHILI-06 | Harvest after regrowth | Again yields peppers; remains planted |
| CHILI-07 | Apply bone meal in Survival and Creative | One age per use; inventory decrements only in Survival |
| CHILI-08 | Break a crop; restart the world; inspect saves | One pepper on break; ages persist, no duplication |
| CHILI-09 | Test multiuser harvesting and lag conditions | One mature harvest is not paid twice |
| CHILI-10 | Check all models and icons on PC and iPhone | Correct sprite, localized name, and four stages |

## Automation and safeguards
- Static 5-test contract covers item placement restriction, 4 growth textures, loot chest targets, and block data.
- Runtime 9-test mock covers harvest bounds, repeat interactions, rollback on spawn failure, absent crop, tick probability, bonemeal consumption, and harmless premature interaction.
- Important failure safety: if an item spawn throws after resetting the crop to regrowing, the script attempts to restore the mature age so a harvest is not silently lost.
- Run `npm run test:chili` for both groups; full in-game validation remains mandatory.

**Do not merge to main or deploy to Xserver until the crop's look, chest odds, survival game mechanics, and compatibility with the recipe catalogue have been reviewed.**
