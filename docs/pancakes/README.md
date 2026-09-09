# パンケーキ導入記録（2026-09-09）

## 反映先
ローカルの development_behavior_packs/ピーネン実験導入3 と development_resource_packs/ピーネン実験導入3。
BP 1.0.62 / RP 1.0.54。サーバーへのアップロードは行っていない。

## 採用した生地
- ID: myname:pancake_batter
- 日本語名: パンケーキ生地
- 最大スタック64。food・use_animation・use_modifiersを持たず、食べられない素材。
- 作業台で牛乳バケツ1、小麦4、卵4を順不同で配置し16個。
- 生地1個をかまどで焼くと myname:pancake 1個。
- 通常1 + ハチミツ入りの瓶1 → ハニーパンケーキ1。
- ハニー1 + スイートベリー2 → ベリーハニーパンケーキ1。
- 通常1 + ハチミツ入りの瓶1 + スイートベリー2 → ベリーハニーパンケーキ1。
- 完成品3種類の既存の食事性能はそのまま。旧無効パックの追加効果スクリプトは移植していない。

## テクスチャ対応
| 入力 | 用途 | 最終ファイル |
|---|---|---|
| Downloads/image.png | 通常 | [pancake.png](C:/Users/はーにゃ。/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang/development_resource_packs/ピーネン実験導入3/textures/items/pancake.png) |
| Downloads/image(1).png | はちみつ | [honey_pancake.png](C:/Users/はーにゃ。/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang/development_resource_packs/ピーネン実験導入3/textures/items/honey_pancake.png) |
| Downloads/image(2).png | ベリーはちみつ | [berry_honey_pancake.png](C:/Users/はーにゃ。/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang/development_resource_packs/ピーネン実験導入3/textures/items/berry_honey_pancake.png) |
| 旧RP restored_3c9fb95b の pancake_batter.png | 生地 | [pancake_batter.png](C:/Users/はーにゃ。/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang/development_resource_packs/ピーネン実験導入3/textures/items/pancake_batter.png) |

完成品は内蔵 image_gen による背景・ノイズの整理後、PNGのアルファを保って最近傍補間で256×256に縮小。生地は旧専用画像16×16をコピー。入力原本は変更していない。

## 使用した最終プロンプト
3枚とも同一プロンプトを使用。各呼び出しの編集対象は上の入力画像1枚ずつ。CLI/APIへのフォールバックなし。

```text
Use case: background-extraction. Edit the provided Minecraft pancake item sprite. Preserve the exact pancake design, toppings, warm colors and blocky pixel-art shading. Remove all stray colored speckles, horizontal noise lines and background remnants outside the pancake silhouette. Make the entire background genuinely transparent alpha, no black or checkerboard painted background. Center the complete pancake with a small even transparent margin in a square canvas. Crisp clean edges, no extra objects, text, shadow or redesign. Intended as a <=256px Minecraft item texture. Return the cleaned single sprite.
```

## 検証
- アイテムと追加レシピのJSON読み込み成功。
- 生地にfoodコンポーネントがないことを確認。
- 生地材料が牛乳1・小麦4・卵4、出力16個であることを確認。
- 全5レシピのカスタムアイテム参照先が定義済みであることを確認。
- 4アイテムのアイコン→アトラス→PNGの参照一致を確認。
- 完成品256×256、生地16×16、画像隅のアルファ0を確認。
- 完成品3枚の縮小後画像を目視確認。
- BPのRP依存UUID/バージョン一致を確認。
- ゲーム内の表示・クラフト・かまど・容器返却の実機確認は未実施。

## 参照したレシピ仕様
- [Microsoft Learn: Furnace](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/recipe_furnace?view=minecraft-bedrock-stable)
- [Microsoft Learn: Shapeless](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/recipe_shapeless?view=minecraft-bedrock-stable)

## バックアップ
_workspace/backups/pancakes_20260909_134601/ に変更前のBP/RP manifest、item_texture.json、完成品3枚を保存。

