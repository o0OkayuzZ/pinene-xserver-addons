# 製作方法の追加記録

この文書は131項目の時点の記録です。最新の147項目の状態は [FOOD_TRAVEL_REPORT.md](FOOD_TRAVEL_REPORT.md) を参照してください。

33項目を追加し、図鑑は131項目、サイト全体は148ページになりました。公開コンテンツ7件・選定パック14件です。

- 素材2件：金の小麦、エンチャントされた金の小麦。
- 作業台レシピ30件：Golden Foodsの18件、Deathneriteの道具・防具12件。
- 調理の説明1件：金のジャガイモからベイクド金ジャガイモへの変換と対応設備。

現在の図鑑の内訳はアイテム・ブロック84件、レシピ41件、小さな機能6件です。

## 確認内容

ソースの確認commitは `aea85120954a8b74033b86253c17a04b691dab21`。BP02の各レシピ・小麦素材の定義、BP05の装備用作業台レシピ、RP05の画像を読み取りました。確認パスは各図鑑レコードのevidenceに記録しています。

エンチャントされた金のパンには、金のパンを金ブロックで囲む方法と、エンチャントされた金の小麦3個を横に並べる方法があります。別レシピとして同じ完成品へリンクし、完成品ページから両方を参照できます。

パーカナイト装備の作業台レシピはネザライトインゴットを使います。専用鍛冶台で使うデスネライトインゴットとの違いを各レシピにも記載しました。

金のジャガイモの調理は作業台レシピとは分け、かまど・燻製器・焚き火・魂の焚き火の登録を説明しています。調理時間・燃料消費・経験値は定義から確認できないため掲載していません。小麦素材は食べ物ではなく、パン用の材料として掲載しました。

## 変更ファイル

- `src/data/field-guide.json`：33項目追加。
- `public/images/items/food-gwheat.png`、`food-egwheat.png`：RPからコピーした素材画像。画像は同じ参照先で、ゲーム内のエンチャントの光沢は静止画像に再現していません。
- `scripts/add-crafting-details.py`：確認した定義から追記する開発補助。既存IDがあると停止します。通常のビルドでは実行しません。将来のソース変更時には再監査が必要です。
- README、実装記録、`artifacts/crafting-*.png`、`artifacts/wheat-*.png`。

## 検証と画面

依存バージョンは変更していません。データ検証、型確認（エラー・警告0件）、production build（148ページ）、公開分離テスト4件が成功しました。Chromium 390px・768px・1440pxで21テストが成功し、131個別ページを各幅で巡回しました。private/draftデータを投入した実ビルドと復元後のビルドの出力検査も成功しました。

実際に確認したURL（ローカル）：

- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/craft-food-egbread-from-wheat/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/food-egbread/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/food-gwheat/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/cooking-golden-potato/
- http://127.0.0.1:4321/pinene-xserver-addons/database/recipes/

[PCの追加レシピ](artifacts/crafting-1440.png) / [スマホの追加レシピ](artifacts/crafting-390.png)

[PCの素材説明](artifacts/wheat-1440.png) / [スマホの素材説明](artifacts/wheat-390.png)

## 反映先・未確認事項

ゲーム内クラフト・調理・表示、本番の提供範囲と材料の入手経路は未確認です。参加URLは未設定です。

変更はwebsite/のみ。BP/RP・UUID・manifest・ワールド・読み込み順・Xserverには書き込んでいません。専用ブランチ `web/pine-server-refresh-20260911` でcommitし、[PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1)へ反映します。mainへの直接push・自動merge・本番公開は行いません。
