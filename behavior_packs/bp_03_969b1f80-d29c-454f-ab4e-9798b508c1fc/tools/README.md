# BlueAppleResetV1 Food Tools

These scripts prevent the same food regressions (eat animation mismatch, too-fast consume, no effects).

## 1) Create a safe food item

Run from this folder:

```powershell
.\new_food_item.ps1 -IdentifierSuffix "my_new_food" -DisplayNameJa "新しい食べ物" -DisplayNameEn "My New Food" -EffectsPreset blue_diamond
```

Options:

- `-EffectsPreset none|blue_diamond|enchanted_blue_diamond`
- `-Nutrition` default `18`
- `-SaturationModifier` default `1.2`

This generator always uses the known-good values:

- `minecraft:use_animation = eat`
- `minecraft:use_duration = 1.6` (about vanilla speed)
- no eating slowdown by default (Bedrock did not apply it reliably in this pack)
- no `minecraft:food.effects` (effects are script-driven in `scripts/main.js`)

## 2) Validate all food item JSON files

```powershell
.\validate_food_items.ps1
```

If validation fails, fix reported files before testing in-game.

## 3) Sync food items to world-local pack

```powershell
.\sync_food_items_to_world.ps1
```

It auto-detects the world-local `BlueAppleResetV1/items` path.
If multiple candidate worlds are found, run with an explicit path:

```powershell
.\sync_food_items_to_world.ps1 -WorldItemsDir "C:\...\minecraftWorlds\<world-id>\behavior_packs\BlueAppleResetV1\items"
```

## Recommended workflow

1. Generate item JSON with `new_food_item.ps1`.
2. Add icon and language entries.
3. Run `validate_food_items.ps1`.
4. Run `sync_food_items_to_world.ps1`.
5. Restart Minecraft for clean testing.
