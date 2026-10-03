# Native Cooking Lab — 2026-10-03

This is an isolated feasibility test, NOT the completed cooking UI and NOT a replacement for the working CustomForm probe.

## Decision and scope

Use the documented `minecraft:crafting_table` block component with a private crafting tag. The Minecraft engine owns the 3x3 crafting inventory, recipe matching, item transfers and result taking. Do not implement chest-slot take/refund buttons. The existence of a container schema or screen template alone does not prove availability of a safe custom click API.

The target still includes rank tabs, recipe icons, 3x3 ingredients, output, and real player inventory, without reopening after each selection. This first proof tests the native foundation only. It does NOT implement the target's custom panel arrangement, rank gating, knife durability, or a safe bridge to production cooking recipes. Success of the native baseline must not be reported as completion of that target.

## Isolation

- New BP UUID: `e4cda620-778d-407e-a28c-fba2bd818102`.
- New RP UUID: `0f33ebf9-c36d-42e1-9c48-51938a5e9ac3`.
- Test-only namespace: `pinene_ui_lab`.
- Private recipe tag: `pinene_ui_lab_workbench`.
- No vanilla block/entity definitions, UI JSON overrides, or dependencies on existing cooking packs.
- All recipe inputs and outputs are test items, not production items.
- Diagnostic script is read-only. It does not remove, create, refund or move items, and never opens a form.
- Installer creates new directories only, rejects existing directories/duplicate UUIDs, verifies hashes, and rolls back only its own new directories if copying fails.
- No world pack registration, main branch, PR #33, successful CustomForm branch, or Xserver changes.

## Verified in this session

| Check | Result |
| --- | --- |
| Installed Windows application | Microsoft.MinecraftUWP 1.26.5203.0 |
| Offline tests in working container | 29 passed |
| Same offline suite on user's Windows PC | 29 passed |
| Generated diagnostic JavaScript syntax | Passed |
| Full diagnostic runtime API check | Passed against exact installed @minecraft/server 2.7.0 declarations |
| New development packs installed | BP/RP, 25 files; checksums verified |
| Existing four cooking BP/RP packs | 285 pre-existing files hashed before/after; zero changed |
| World modifications / keyboard or mouse input | None |
| Native GUI rendering, continuous crafting, real item accounting | PENDING |

The foreground check showed Minecraft was not the foreground application and its window rectangle was occluded by another application. No keys or mouse input were sent. Empty logs and successful installations are not treated as engine tests.

Offline tests cover identifiers/tags, recipe ratios, absence of UI and inventory-write code, image decoding, archive structure, installation checksums, overwrite refusal, duplicate UUID rejection and failure cleanup. Recipe conservation arithmetic tests are NOT simulations of Minecraft crafting.

## Build / install

```text
python build_native_lab.py --source-items <approved-64px-items-directory> --out <new-build-directory>
```

Required approved PNGs: `whole_cheese.png`, `cheese.png`, `noodles.png`, `cooking_oil.png`. The builder copies these unchanged into the isolated RP.

Alternatively `--mojang <com.mojang-directory>` locates the current food resource pack by UUID. Add `--install` to install ONLY the independent lab BP/RP into new development-pack directories. It does not activate them in any world. Build outputs include BP.mcpack, RP.mcpack and Pinene_Native_Cooking_Lab_v1.mcaddon.

The user's PC already has `Pinene_Native_Cooking_Lab_BP` and `Pinene_Native_Cooking_Lab_RP` installed in its development-pack directories. Do not import a duplicate merely to run the first test.

## First native test (Japanese)

新しい空の使い捨て試験ワールドを作り、**Pinene Native Cooking Lab BP / RP** だけを有効化する。チートON、クリエイティブで開始する。実験トグルは使わない。普段の開発ワールドや本番には追加しない。

```mcfunction
/give @s pinene_ui_lab:workbench
/function pinene_ui_lab/kit
```

試験台を安全な地面に置く。キットは初回だけ実行し、追加投入しない。キットは試験小麦48個、種32個、空瓶4個、ホールチーズ4個を渡す。次にサバイバルにして、台の近くで初期個数を記録する。

```mcfunction
/gamemode survival
/scriptevent pinene_ui_lab:baseline run
```

空手で試験台を開き、レシピ変更、通常の連続作成、Shiftでのまとめ作成を確認する。画面を閉じてカーソルのアイテムを戻し、記録地点の4ブロック以内で検査する。

```mcfunction
/scriptevent pinene_ui_lab:check run
```

レシピはすべて試験専用。
- 小麦3個を縦一列 → 麺1個。
- ホールチーズ1個 → チーズ4個。
- 種8個で空瓶を囲む → 調理油1個。

全キットを使い切った場合の期待値は麺16個、チーズ16個、油4個。途中で止めても材料との換算値は同じになる。

## Native acceptance checklist

- [ ] Recipe book, 3x3, result and actual 27+9 player slots display correctly.
- [ ] Selecting different recipes repeatedly does not close the screen.
- [ ] Repeated crafting does not close the screen.
- [ ] Ordinary and Shift crafting consume the specified quantities.
- [ ] Closing with ingredients left in the grid returns unconsumed inputs.
- [ ] Full inventory and partially available space do not lose or duplicate items.
- [ ] Lab recipes do not appear on an ordinary crafting table.
- [ ] Ordinary recipes do not appear on the lab table.
- [ ] Two players opening the same lab block have independent crafting state.
- [ ] Disconnect, death, carried cursor items, controller and touch are checked separately.

## Limits of the count checker

The checker is deliberately limited to single-player survival and sums player-inventory items plus dropped items within eight blocks of the recorded location. Run after closing the crafting screen. Do not introduce extra kits, containers, hoppers, other players, item pickup by mobs or unrelated inventory changes between measurements. Counts by item ID do not verify metadata or durability retention. A sampled-balance OK message is NOT proof of all edge cases, multiplayer safety, or final UI correctness.

Disable the lab only in its disposable world when finished. The original cooking/CustomForm files were not modified and need no rollback.

## Primary references inspected

- Microsoft Learn: minecraft:crafting_table, stable (enables the native crafting UI, private crafting tags; released from experiment in 1.19.50): https://learn.microsoft.com/en-us/minecraft/creator/reference/content/blockreference/examples/blockcomponents/minecraftblock_crafting_table?view=minecraft-bedrock-stable
- Microsoft Learn: BlockInventoryComponent: https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockinventorycomponent?view=minecraft-bedrock-stable
- Mojang bedrock-samples ref `46ba6ea985fb5a92d79a9419198f10dda14c199d`, `resource_pack/ui/data_driven_container_screen.json` and `metadata/json_schemas/server/block/1.26.20/container.json` (inspected, not used as evidence of arbitrary custom click support).

Command examples were checked against the documented /scriptevent syntax and include its required message payload (`run`).
