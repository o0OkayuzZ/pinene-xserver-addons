# Native cooking UI / knife gameplay QA (2026-10-15)

**Status: automated checks passed; in-game PC/iPhone verification not yet done.**
This is a validation script for a **copy of the development world**, not instructions to deploy to Xserver or overwrite a live world.

## Preconditions
- Ensure the Pinene Food BP/RP and Cooking Tools BP/RP come from the **same development revision**.
- Make a save backup; record the exact Minecraft Bedrock and pack versions.
- Equip the player with a clean copper knife, book, milk bucket, bottles, whole cheese, carrot, and enough empty inventory space.
- Keep Content Log open for parsing/Script API errors.

## Cases (mark completed only after playing)

| ID | Action | Expected |
| --- | --- | --- |
| UI-01 | Interact with an empty cutting board (empty hand) | No native crafting screen; clear guidance to place a knife |
| UI-02 | Put a copper knife on the board, interact empty-handed | Native crafting screen with usable recipe slots, not an action-form imitation |
| UI-03 | Use an ordinary Minecraft crafting table | Unrelated vanilla crafting is unaffected |
| GUIDE-01 | Hold a book and use the cutting board | Only the custom recipe guide opens, not the native crafting screen |
| GUIDE-02 | Choose a Rank, open a discovered recipe, press Back, return to Rank list | Rank → dishes → details → Rank navigation remains coherent, without duplicate forms |
| GUIDE-03 | Open undiscovered Rank I+ recipes | Hidden as ？？？ with no recipe ingredient/name leakage |
| GUIDE-04 | Obtain a discovery ingredient once and reopen guide | Related recipes unlock permanently; reconnect/reload does not reset progress |
| RANK-01 | Craft a dish above the copper knife's Rank II | Recipe not craftable on this board |
| RANK-02 | Try with gold/iron/diamond/netherite knives | Rank IV/III/VI/VII limits respected |
| KNIFE-01 | Place, retrieve, rename, and reload a worn knife | Exactly one knife; name/lore/wear preserved |
| KNIFE-02 | Attempt retrieval with full inventory | Knife stays stored; no loss or duplication |
| KNIFE-03 | Open native cooking and close without crafting | Wear count unchanged |
| KNIFE-04 | Craft whole cheese → cheese and close the screen | One wear session (not one wear per output item) |
| KNIFE-05 | Shift batch-craft one recipe in the same open screen | Only one wear session |
| KNIFE-06 | Switch from cooking screen to guide with a book without moving | Board reservation released; no phantom knife wear |
| MULTI-01 | A opens native cooking; B tries to use/retrieve same board | B cannot take the occupied knife |
| MULTI-02 | A opens guide; B uses same board | B can take over without waiting for a 10-minute timeout |
| WORLD-01 | Save/reload, then return to a knife-equipped board | State is intact, no duplicate or orphaned holders |
| MOBILE-01 | Repeat UI, guide, inventory, Rank, and retrieval cases on iPhone | Same game rules; no missing buttons, invisible items or overlay errors |

## Known limits
- The stable Script API integration detects a craft using observed **output increase plus ingredient decrease** (inventory + cursor); it has no exact native craft event to bill sessions. Test the sequence actually in game, especially Shift batches, cursor-held output, and container returns.
- Do **not** mark a behavior as verified based solely on Node mocks, static recipe tests, or Content Log startup success.
- The second wave of 27 dishes is still a separate development task. This QA matrix only covers the current native UI and knife system.

## Outcome notes
Record: game version, device, pack versions, pass/fail ID, screenshot/video, relevant Content Log lines, and steps to reproduce. If any core gameplay case fails, leave the implementation branch unmerged and Xserver unchanged.
