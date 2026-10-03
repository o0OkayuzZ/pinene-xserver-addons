# Native cooking / minimal integration — 2026-10-03

## Adopted direction
Keep Minecraft's native crafting UI and inventory unchanged. No JSON UI overrides, custom forms, Rank tabs, explanatory panels, or re-opening on each click.
The previously successful native lab and CustomForm/ActionForm prototypes are preserved. This branch changes only the builder, prototype source, and tests; main and Xserver are not deployed.

## Implemented in the separate world
- 34 existing recipe definitions: seven base ingredients and 27 dishes. Counts and layouts are taken from PR #33 source commit 344eec32abbb5e73af1cefdb04369efb759e9e03.
- 38 native recipe files including four homogeneous oil variants and the existing whole-cheese furnace recipe.
- 13 existing cutting-board models, five knife types. Native crafting tags follow the placed knife: copper II, iron III, gold IV, diamond VI, netherite VII.
- No knife: interaction is blocked. Placing/retrieving a knife uses native container transfers, preserving its existing name, lore, enchantments and damage.
- Stored knives cannot be siphoned out. Occupied boards temporarily refuse mining; retrieve the knife first. Explosion and piston movement are disabled for these test boards.
- Food/knife definitions and textures are copied into new world-local packs. The base pancake dependency is copied from its explicitly recorded repository source, not replaced with an unrelated ingredient.

## Important limits
- Craft-time knife durability consumption is NOT implemented. Do not infer crafting from changes to inventory counts.
- Native rank filtering and persistent crafting after changing a knife are not yet engine-verified.
- Oil currently requires eight seeds of one type. Mixed seeds are not restored in this phase.
- Single-player prototype only. Multiplayer, occupied-board destruction, unusual closure/death states and full-inventory edge cases need separate validation.
- This is not a production replacement. Base pancake creation, unrelated pack features and custom UI code are deliberately not imported.

## Ready world
World list name: **料理UI試験場（ナイフ連携）**. World-local packs are already enabled; first entry supplies ingredients and five knives automatically.
中央：ネザライト付きまな板。左：銅付き。右：ナイフなし。奥の樽：追加材料。左端：炉。右端：普通の作業台。
手を空けてまな板を開く。銅では低ランク料理のみ、中央では全登録料理が作れるか比較する。スニーク＋操作でナイフを回収し、手持ちの別ナイフを置いて再確認する。
途中でレシピを変更したり連続作成しても画面が閉じないことを確認する。今回は耐久が減らないのが未実装の状態であり、合格条件に含めない。

## Verification
Windows: all 20 Python compiler tests and 13 JavaScript mock tests passed (no skips). The scripts compiled against the exact installed stable @minecraft/server 2.7.0 declarations.
Mock transfer tests cover 100 place/retrieve cycles, full inventory rejection, rollback and metadata retention. These are not Minecraft engine tests.

## Phase 1 review revision
- Keep native UI and stable server 2.7.0; no beta toggles, polling-based wear or form reopening.
- The five container-returning recipes use compact shaped definitions and native multiple results. Mixed output types in shapeless lists are rejected by the observed game log. Ingredient/output counts are unchanged; manual placement is now shaped for these five recipes.
- A queued placement verifies the original knife name/lore/damage/enchants/dynamic properties, not only its type. A same-type replacement is not consumed.
- Exhausted/invalid-damage knives cannot enable native crafting. Retrieving a stored knife still preserves its ItemStack.
- One extra copper-knife fixture has damage 37 and a unique test name. Place/retrieve it to verify metadata retention.
- This revision is a separate new world. Earlier successful worlds and currently loaded packs are not changed.
- Craft-time durability consumption remains NOT implemented. Native gameplay verification of this revision is pending.
