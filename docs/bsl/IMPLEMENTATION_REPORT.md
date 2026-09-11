# Better Structure Loot Phase 0.5 / v1.0.15

2026-09-11。ゲーム内テスト前の静的検証完了。

基準: `o0OkayuzZ/pinene-xserver-addons` の取得時点の最新main、`8d98749d3abd30cad564b1c28fa5b24a2580ee90`。
添付レポートの基準コミットと一致し、ZIP作成後の競合変更はなかった。
専用ブランチ: `integrate/bsl-phase-0.5-v1.0.15`。

## 統合内容

- BSLの36 chest tableを更新し、food 3件・collectibles 4件の共通テーブルを追加。ZIPの全44ファイルと統合結果のJSON内容が一致。
- manifestのheader/data/script versionを1.0.14から1.0.15へ更新。UUID・依存関係・engine versionは保持。
- ZIPに含まれないルートと`worlds/Bedrock level/`の`world_behavior_packs.json`もBSLの登録バージョンだけ1.0.15へ同期。
- Infinite Castle、Dungeon、他パック、BSLの既存壺テーブルとスクリプトは変更なし。基準コミットとの差分の許可範囲を検証。
- 元レポートは[SOURCE_REPORT.txt](SOURCE_REPORT.txt)、ZIPのSHA-256・全ファイルのハッシュ・Profileごとの確率は[provenance.json](provenance.json)に保存。

## 主要before / after

| 対象 | before (main 1.0.14) | after (Phase 0.5) |
|---|---|---|
| レア報酬 | 青リンゴ・Waystone・CD・フィギュア等が同じ重み付き枠で競合 | 青リンゴ・Waystone・Warpstone・食品カテゴリ・Collectibleを専用の確率付きPoolへ分離 |
| Collectible | 直接チェストの報酬候補に混在 | 独立Poolから共通テーブルへ。Common / Rare / Special = 70 / 25 / 5、計34種 |
| 食品 | チェストごとに直接候補を列挙 | Pancake / Golden Food / Enchanted Golden Foodの3共通テーブル |
| End City | 通常資源PoolにDragon Eggあり | Dragon Eggなし。青リンゴ0.60%、Waystone5.5% |
| Trial Chamber | intersection等にMace / Heavy Coreあり | 5つの通常チェストから両方を除外。Highのレア確率、入口・供給・通路は供給寄りの基礎Pool |
| Ice Box | 食品に加え資源・装備等の混在レアPool | 食品特化Special。通常Golden Food 2–4 roll、Enchanted Golden Food 1–3 roll |
| Buried Treasure | 一般の混在レアPool | 海洋・資源特化Special。Heart of the Sea確定、Diamond 24–64等の資源枠 |
| Bastion Treasure | Netherite / Parcaniteテンプレートが重み1 / 10で競合 | Netheriteテンプレート確定。別の進行報酬枠でDeathnerite Ingot 18%、Parcaniteテンプレート10%、空72% |
| 3種のSpecial | 混在レアPool | 青リンゴ1.20%、Waystone12%、Warpstone4%、Collectible30%を別々に抽選 |

Parcaniteは`true_dn:darkness_upgrade_smithing_template`、Deathneriteは`true_dn:deathnerite_ingot`を使用し、実体定義を確認した。
**BastionのDeathnerite / ParcaniteはZIPどおり互いに排他的な1枠**であり、両者を独立抽選には変更していない。青リンゴ・Waystone等とは独立。

全36件の直接アイテム追加・削除、Pool数、変更前の該当レアPoolは[before-after.json](before-after.json)に記録。
共通テーブルへの移動も「直接候補からの削除」に含まれるため、削除一覧だけで到達不能とは判断しない。

## 検証結果

実行: `python -X utf8 tools/validate_bsl_phase05.py`

- 全有効BPのloot table **425件**を検査。**419件は厳密JSON正常**、既存Dungeonの**6件はコメント付きJSONとして正常**。BSLは壺を含む44件すべて厳密JSON正常。
- nested参照291件を検査。参照切れ・循環なし。BSLの追加参照は全件リポジトリ内で解決。
- 全loot tableから使われるcustom ID **520種**、うちBSL **57種**を、有効パックのitem / block定義と照合し、未定義0件。
- Dungeonパックのitem / block実体 **516種**とBSLを照合し、混入0件。
- 36チェストと共通サブテーブルにMace / Heavy Core / Dragon Eggなし。
- 36件のProfile別レア確率、食品等の独立抽選、Collectible分離、3つのSpecialの必須枠を確認。
- runtime差分はBSLの44ファイルとワールド登録2ファイルのみ。Infinite Castle関連変更なし。

機械可読の参照一覧と全BSL custom IDの定義パスは[validation.json](validation.json)に収録。

## 既存事項・ゲーム内未確認事項

1. Dungeonの`loot_tables/trial_arena/vault/{basic,desert,end,jungle,mountains,snowy}.json`はコメントがあるため厳密JSON検査には通らない。コメント除去後の構文は正常で、基準コミットから未変更。今回勝手に修正していない。
2. Dungeonの`royal_guard_raid.json`が参照する`loot_tables/entities/raider_drops.json`はリポジトリ内にはない。[Mojang公式のバニラテーブル](https://raw.githubusercontent.com/Mojang/bedrock-samples/main/behavior_pack/loot_tables/entities/raider_drops.json)に実在することを確認した（2026-09-11）。
3. **既存のBSL `loot_tables/pots/trial_chambers/corridor.json`にはHeavy Coreがある。** 今回の36チェストとは別で、そこからの参照もない。ZIP対象外のため変更せず残した。
4. 既存BSL確認マーカースクリプトの表示は`1.0.7`のまま。ZIPにスクリプト変更はなく保持したため、今回のバージョン確認にはmanifestを使う。
5. レポート記載の23–27スタック等は添付元のシミュレーション値。今回、ゲームでのスロット配置・結合・溢れや確率分布は未検証。静的検査をゲーム内成功とは扱わない。

新規の統合不具合は検出されなかった。既存事項は仕様を変えず記録した。

## ゲーム内テストの確認点

テスト用ワールドでBSL 1.0.15の読み込みとコンテンツログを確認し、未開封・新規生成チェストを使う。
36種類を各1回以上確認し、特にIce Box / Buried Treasure / Bastion Treasure、End City、Trial Chamber 5種を重点確認する。
食品・CD・フィギュア・Waystone・青リンゴが実体として取得でき、27スロットへの配置で必要な確定枠が失われないことを確認する。
低確率枠の分布確認には十分な反復が必要。少数チェストで青リンゴが出ないことは異常の証拠にはならない。
この作業ではゲーム起動・ワールド配備・サーバーデプロイ・pushを行っていない。

## 36 Profileと変更ファイル一覧

以下は添付ZIPの進行確率に基づく監査用Profile名。構造物固有の資源・食品・装備Poolの違いはZIPどおり保持する。

| Chest (loot_tables/chests/ ??) | Profile | ???? | Waystone | Pool? before ? after |
|---|---|---:|---:|---:|
| `abandoned_mineshaft.json` | Mid | 0.3% | 3% | 4 ? 13 |
| `ancient_city.json` | End | 0.6% | 5.5% | 3 ? 17 |
| `ancient_city_ice_box.json` | Special | 1.2% | 12% | 2 ? 11 |
| `bastion_bridge.json` | End | 0.6% | 5.5% | 6 ? 17 |
| `bastion_hoglin_stable.json` | End | 0.6% | 5.5% | 5 ? 16 |
| `bastion_other.json` | End | 0.6% | 5.5% | 6 ? 16 |
| `bastion_treasure.json` | Special | 1.2% | 12% | 5 ? 20 |
| `buriedtreasure.json` | Special | 1.2% | 12% | 8 ? 22 |
| `desert_pyramid.json` | Mid | 0.3% | 3.5% | 4 ? 14 |
| `end_city_treasure.json` | End | 0.6% | 5.5% | 3 ? 15 |
| `igloo_chest.json` | High | 0.4% | 2% | 3 ? 13 |
| `jungle_temple.json` | Mid | 0.3% | 3.5% | 3 ? 14 |
| `nether_bridge.json` | High | 0.4% | 3.5% | 3 ? 15 |
| `pillager_outpost.json` | Mid | 0.3% | 3.5% | 8 ? 14 |
| `ruined_portal.json` | Mid | 0.3% | 3% | 3 ? 14 |
| `shipwreck.json` | Mid | 0.3% | 2% | 4 ? 15 |
| `shipwrecksupply.json` | Early | 0.15% | 1% | 4 ? 15 |
| `shipwrecktreasure.json` | Mid | 0.3% | 3.5% | 5 ? 15 |
| `simple_dungeon.json` | Mid | 0.3% | 3.25% | 4 ? 13 |
| `spawn_bonus_chest.json` | Early | 0.15% | 0.25% | 18 ? 13 |
| `stronghold_corridor.json` | High | 0.4% | 3.5% | 3 ? 14 |
| `stronghold_crossing.json` | High | 0.4% | 3.5% | 2 ? 13 |
| `stronghold_library.json` | High | 0.4% | 3.5% | 3 ? 14 |
| `trial_chambers/corridor.json` | High | 0.4% | 2% | 2 ? 13 |
| `trial_chambers/entrance.json` | High | 0.4% | 2% | 2 ? 13 |
| `trial_chambers/intersection.json` | High | 0.4% | 3.5% | 2 ? 13 |
| `trial_chambers/intersection_barrel.json` | High | 0.4% | 3.5% | 2 ? 13 |
| `trial_chambers/supply.json` | High | 0.4% | 2% | 2 ? 13 |
| `underwater_ruin_big.json` | Mid | 0.3% | 3.5% | 4 ? 14 |
| `underwater_ruin_small.json` | Mid | 0.3% | 2% | 4 ? 14 |
| `village/village_desert_house.json` | Early | 0.15% | 0.5% | 3 ? 13 |
| `village/village_plains_house.json` | Early | 0.15% | 0.5% | 3 ? 13 |
| `village/village_savanna_house.json` | Early | 0.15% | 0.5% | 3 ? 13 |
| `village/village_snowy_house.json` | Early | 0.15% | 0.5% | 3 ? 13 |
| `village/village_taiga_house.json` | Early | 0.15% | 0.5% | 3 ? 13 |
| `woodland_mansion.json` | High | 0.4% | 4% | 5 ? 15 |

????????52??runtime 46?????????1?????????5???

- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/collectibles/all.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/collectibles/common.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/collectibles/rare.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/collectibles/special.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/food/enchanted_golden_foods.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/food/golden_foods.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/bsl/food/pancakes.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/abandoned_mineshaft.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/ancient_city.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/ancient_city_ice_box.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/bastion_bridge.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/bastion_hoglin_stable.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/bastion_other.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/bastion_treasure.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/buriedtreasure.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/desert_pyramid.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/end_city_treasure.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/igloo_chest.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/jungle_temple.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/nether_bridge.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/pillager_outpost.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/ruined_portal.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/shipwreck.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/shipwrecksupply.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/shipwrecktreasure.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/simple_dungeon.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/spawn_bonus_chest.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/stronghold_corridor.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/stronghold_crossing.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/stronghold_library.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/trial_chambers/corridor.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/trial_chambers/entrance.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/trial_chambers/intersection.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/trial_chambers/intersection_barrel.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/trial_chambers/supply.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/underwater_ruin_big.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/underwater_ruin_small.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/village/village_desert_house.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/village/village_plains_house.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/village/village_savanna_house.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/village/village_snowy_house.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/village/village_taiga_house.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/loot_tables/chests/woodland_mansion.json`
- `behavior_packs/bp_01_423276b9-02f5-4082-911a-c631a2d83d12/manifest.json`
- `docs/bsl/IMPLEMENTATION_REPORT.md`
- `docs/bsl/SOURCE_REPORT.txt`
- `docs/bsl/before-after.json`
- `docs/bsl/provenance.json`
- `docs/bsl/validation.json`
- `tools/validate_bsl_phase05.py`
- `world_behavior_packs.json`
- `worlds/Bedrock level/world_behavior_packs.json`
