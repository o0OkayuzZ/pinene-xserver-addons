# 食料・装備の追加記録

Golden FoodsとDeathneriteの説明、図鑑48項目を追加しました。現在は7公開コンテンツ、14選定パック、図鑑98項目、静的ページ115件です。注目4コンテンツの設定は維持しています。

## 追加内容と根拠

- アイテム40件：食料18件、金食料図鑑、デスネライト装備9件、パーカナイト装備9件、素材2件、高度な鍛冶台。
- 作業台レシピ6件：金のパン、エンチャントされた金のパン、金のビートルート、両系列の剣、高度な鍛冶台。
- 小さな機能2件：食事効果の優先ルール、専用鍛冶台での強化。

合計の内訳はアイテム・ブロック82件、レシピ11件、機能5件です。

確認したゲームコードのcommitは `aea85120954a8b74033b86253c17a04b691dab21`。各レコードに確認ファイルの相対パスを保存し、公開HTMLには出していません。

Golden FoodsはBP02の個別食料定義、data.js、main.js、core.js、capabilities.jsとレシピを照合しました。無効化されている状態異常解除・消火・既存効果時間の短縮を使える能力として掲載していません。回復値は暫定値を含む設定値として扱い、基本効果の種類・レベル・秒数を記載しました。

DeathneriteはBP05のアイテム定義、main.js、SmithingRecipes.js、作業台レシピとRP15の日本語名を確認しました。装備の耐久値・防御値・ダメージ設定値を掲載し、特殊能力は未確認としました。パーカナイトの剣は、作業台ではネザライトインゴット、専用鍛冶台ではデスネライトインゴットを使う定義の違いを明記しています。

## 変更ファイル

- `src/data/field-guide.json`：48件追加。
- `src/data/content-registry.json`：Golden FoodsとDeathneriteを公開用説明へ更新。
- `src/data/pack-registry.json`：該当BP/RPの4パックを追加。manifestとworld登録を読み取り照合。
- `public/images/items/`：RP05から食料・本の画像19枚をコピー。既存分と合わせ57枚。
- `public/images/golden-foods.svg`、`deathnerite.svg`：コンテンツカード用の独自仮イラスト。
- `scripts/add-food-equipment.py`：確認済み項目を追記する開発補助。ビルドからは実行しません。既存IDがある場合は停止します。将来のソース変更時には人による再監査が必要です。
- `tests/guide.spec.ts`：機能フィルターの件数を公開データから検証。
- README、各実装記録、`artifacts/`の画面記録。

RP15は画像参照の定義はありますが、該当装備の画像本体がありません。21件の装備・素材・鍛冶台は画像準備中として表示しています。

## 検証

- 依存バージョン変更なし。既存の固定依存を使用。
- データ検証：98公開項目・7公開コンテンツ・14選定パックで成功。
- 型確認：34ファイル、エラー・警告・ヒント0件。
- production build：115ページで成功。
- 公開分離・データ異常のテスト：4件成功。
- private/draft識別用データを投入した実ビルドと復元後の実ビルドで、125テキスト出力への非公開情報の混入検査が成功。
- Chromium 390px・768px・1440px：21テスト成功。図鑑98ページすべてのHTTP応答、見出し、横はみ出し、リンク・画像を確認。検索・フィルター・リセット・レシピへの操作も成功。

実際に開いたURL（ローカル）：

- http://127.0.0.1:4321/pinene-xserver-addons/database/items/?content=golden-foods
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/food-gbread/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/craft-parcanite-sword/
- http://127.0.0.1:4321/pinene-xserver-addons/contents/golden-foods/
- http://127.0.0.1:4321/pinene-xserver-addons/contents/deathnerite/

ほか、98件すべての個別ページと全公開ルートをブラウザテストで巡回しました。

[PCの食料一覧](artifacts/foods-1440.png) / [スマホの食料一覧](artifacts/foods-390.png)

[PCの食料詳細](artifacts/food-detail-1440.png) / [スマホの食料詳細](artifacts/food-detail-390.png)

[PCの装備レシピ](artifacts/equipment-recipe-1440.png) / [スマホの装備レシピ](artifacts/equipment-recipe-390.png)

## 未確認事項と反映先

実ゲーム内での回復量・特殊能力・鍛冶台操作・クラフト・表示、本番の提供範囲は未確認です。参加URLは未設定です。

変更はwebsite/のみで、MinecraftのBP/RP・UUID・manifest・ワールド・読み込み順・Xserver設定には書き込んでいません。専用ブランチ `web/pine-server-refresh-20260911` から既存の [PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1) に反映します。mainへの直接push、自動merge、本番公開は行いません。
