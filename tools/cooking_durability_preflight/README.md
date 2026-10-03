# Native cooking durability: preflight only

Status: NOT installed into Minecraft. There is no live crafting-time knife wear in this revision.

The user has confirmed the 34 recipes, knife material rank limits and native table header. Keep this working native UI and its existing world unchanged. Do not replace it with custom forms, an inventory snapshot, new recipe reagents, post-hoc item removal/refund, or an inventory-delta guess.

## Actual environment checked

- Microsoft.MinecraftUWP 1.26.5203.0.
- Current cooking world imports @minecraft/server 2.7.0.
- Current successful source: cfe7972eb7d9f11bbc4af234e3bbda11a79a9170.
- Knife maximum durability found in the actual world items: copper 96, iron 128, gold 64, diamond 512, netherite 640. These values were not changed.

## Exact published package comparison

The official npm tarballs were fetched and checked against their published SHA-1. The extracted declaration SHA-256 values are recorded in API_AUDIT.json. TypeScript contracts verify both negative cases and a positive control, rather than assuming a missing text match proves absence.

| @minecraft/server package | playerCraftRecipe after-event | craft before-event / cancellation |
| --- | --- | --- |
| 2.7.0 (existing dependency) | absent | absent |
| 2.10.0 (published stable) | absent | absent |
| 2.11.0-beta.1.26.52-stable (beta for the user's game) | absent | absent |
| 2.12.0-beta.1.26.60-preview.29 (Preview) | present | absent |

The Preview event only contains player, optional block and optional output ItemStack. It does not supply a recipe ID or a cancel flag. The Preview crafting context is also absent from the game-matched packages. Changing only a manifest version or enabling Beta APIs on the current world is not an established solution.

Even where an after-event exists, it does not itself authorize or reject the native transaction before ingredients are spent. Its batch granularity, container-return notifications and timing must be measured. Do not claim that breaking a knife after a notification prevents an already-committed Shift batch.

## Code delivered here

- durability_core.mjs: pure, non-engine plans for exact or capped batches, output multiplicity and remaining durability. Billing unit is required, not inferred. Tests cover both per-recipe execution and per-output policies without selecting/changing the live game policy.
- nativeIntegrationGate in that module: explicit evidence requirements; a hypothetical contract, not invented Minecraft APIs. An after-event alone never opens the gate.
- describeCraftOutput: candidate analysis only. Returned containers, ambiguous products and partial-stack observations cannot be billed. chargeAllowed is always false until a separately validated authority exists.
- preview_event_probe.ts: bounded, read-only event recorder for the exact Preview declaration. No inventory, knife, recipe or UI mutations. Not imported into any world, and not claimed to run on the user's current game.
- absent_api_contract.ts / preview_api_contract.ts: reproducible type-contract checks for the missing members and the Preview-only members.

## Verified and not verified

55 pure JavaScript tests passed in the working container and on the user's Windows PC. Four exact-package API contracts compiled, including the complete read-only Preview observer against its target declarations. These are not Minecraft crafting tests and do not enable durability.

No game version update, Minecraft Preview installation, beta dependency activation, world experiment toggle, native crafting handler change, live knife/recipe/UI edit, main merge or Xserver deployment was made. The successful world packs were compared by hashes before/after; see STATUS.json.

## Remaining acceptance gates

1. A verified pre-commit authority or native constraint must limit the number of accepted operations by the available knife budget without consuming excess ingredients.
2. Material removal, primary output, container returns and knife wear must be one consistent operation, including normal cursor taking and Shift batching.
3. Remaining durability one must not permit an oversized batch or a cached recipe after breakage.
4. Metadata, full inventories, closing, disconnect, death and multiple players need engine tests.
5. The 10 percent knife-break rule for crimson/warped mushroom ingredients must preserve the completed dish when those recipes are integrated; it is not connected by this normal-recipe preflight.

No live billing unit was changed. Earlier prose and legacy implementations differ on per-operation versus per-output wear; the eventual integration must resolve that explicitly, not infer it from event count.

## Primary references

- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playercraftrecipeafterevent?view=minecraft-bedrock-experimental
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/changelog?view=minecraft-bedrock-experimental
- https://registry.npmjs.org/@minecraft%2fserver
