# 金素材・既存の金食材

2026-10-19。高ランク料理のための素材追加。新しい料理名や料理の効果はこの変更では決めない。

## 作成ルール

| 作成する素材 | 中心の1マス | 周囲の8マス | 完成数 |
|---|---|---|---:|
| 金素材 | 通常の素材×1 | 金インゴット×8 | 1 |
| エンチャントされた金素材 | 対応する金素材×1 | 金ブロック×8 | 1 |

作業台の3×3で作成する。ナイフは不要。エンチャント素材は通常素材から直接作らず、金素材を一段階強化する。金素材は素材として扱い、食べる効果を持たせない。

対象はバター、チョコ、ミルク瓶、チーズ、調理油、ゼラチン、麺の7種類。金版・エンチャント金版で14アイテム、14レシピ。

| 通常素材 | 金素材ID | エンチャント金素材ID |
|---|---|---|
| バター | `pine:golden_butter` | `pine:enchanted_golden_butter` |
| チョコ | `pine:golden_chocolate` | `pine:enchanted_golden_chocolate` |
| ミルク瓶 | `pine:golden_milk_bottle` | `pine:enchanted_golden_milk_bottle` |
| チーズ | `pine:golden_cheese` | `pine:enchanted_golden_cheese` |
| 調理油 | `pine:golden_cooking_oil` | `pine:enchanted_golden_cooking_oil` |
| ゼラチン | `pine:golden_gelatin` | `pine:enchanted_golden_gelatin` |
| 麺 | `pine:golden_noodles` | `pine:enchanted_golden_noodles` |

## 瓶と器

金加工では容器を完成素材の中に保持する。たとえばミルク瓶から金のミルク瓶を作った段階では、空き瓶を追加で返さない。金・エンチャント金のミルク瓶、調理油、ゼラチンを料理材料として使うと、使った数だけ空き瓶を返す。

既存の金ミルクのバケツは調理時に空きバケツ、既存の金リンゴシチューは空きボウルを返す。調理で食事用の効果が発動する処理は追加しない。

## 既存の金食材

`golden-ingredients.json` の `existing_ingredients` が材料として利用できる27種を記録する。バニラの金のリンゴ、エンチャント金のリンゴ、金のニンジン、きらめくスイカの薄切りの4種と、既存金食料パックの23種。

既存パックの金小麦・金パン・金卵・金ミルク・金コーラスフルーツ・金野菜・金シチューなどは既存IDをそのまま参照する。対応パックがある場合だけカスタム食材を使う。Pine Foodはそれらのアイテムや既存レシピ、食事効果を再定義せず、そのパックへの必須依存も追加しない。

通常料理の材料を金素材に自動置換しない。今後ユーザーが考える料理のレシピに、使う金素材・金食材を個別に指定する。

## ランクと品数

料理の設計上限はRank X。素材は料理ランクを持たず、図鑑では基礎素材と同じ素材カテゴリに表示する。作業台で作れることを明記し、まな板のナイフが未設定でも金加工を不可と表示しない。

料理の採用済み名称は54品。前の100品候補表に含まれる助手提案46品は未採用・保留。素材14種も既存の金食材も、新しい完成料理として100品に加算しない。現行ナイフの実装上限VIIはこの変更では拡張しない。VIII–Xの料理を追加する際は、対応する道具の入手経路を先に整える。

## アイコン候補

元の素材の承認済み画像を編集対象にし、組み込みの `image_gen` で金色版を1素材につき1枚生成した。元画像を保持し、新しいファイルに保存。出力の加工は32×32への最近傍縮小のみ。透明度を保持している。

保存先は `resource_packs/rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2/textures/items/golden_*.png`。エンチャント金版は対応する金版の画像を共有し、`minecraft:glint` で輝きを付ける。7個の最終プロンプト、対応する保存パス、SHA-256は `golden-material-art.json` に記録。生成候補であり、ユーザーによる見た目の採用判断と実機描画の確認は未完了。

## 検証と公開

`npm run test:cooking100` で生成結果の一致、料理・素材の品数、囲みの配置と金の消費数、容器の二重返却防止、既存食材ID、ナイフ不要の図鑑表示、Rank Xの読み取りを確認する。既存の金食料テストも別途実行する。

この変更は開発ブランチ用。本番適用・販売開始・実機確認済みを意味しない。専用料理はまだ追加していないため、今は素材の入手とレシピでの参照に対応した段階。

参考: [Shaped Recipe](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/recipereference/examples/recipedefinitions/minecraftrecipe_shaped?view=minecraft-bedrock-stable)、[minecraft:glint](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_glint?view=minecraft-bedrock-stable)。
