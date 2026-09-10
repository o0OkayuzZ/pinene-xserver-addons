# アイテム・細かな機能の図鑑追加

PINE SERVERの図鑑に50項目の個別ページを追加しました。公開コンテンツは経験値ストレージを加えて5件、サイト全体は65ページです。注目カードの初期4件は従来どおりです。

## 掲載範囲

- アイテム・ブロック42件：Mycologyのキノコ35種、キノコ図鑑、経験値タンク・パイプ・バルブ・抽出器、Dungeonsのホークブランド・英雄の書。
- 作業台レシピ5件：キノコ図鑑と経験値設備4種。材料、配置指定の有無、配置表、完成数、完成アイテムへのリンク。
- 小さな機能3件：キノコの鑑定、発見記録、使い分け。

Mycologyの効果はregistry.jsの設定、個別アイテム定義、effects.jsの登録・処理を照合しています。直接効果、遅延、抽選、体力消費、感知、胞子の範囲効果、使用しない標本を分けて説明しました。現実の食用・毒性解説は取り込んでいません。予約済みの研究ポイントを使用可能な機能とは記載していません。

経験値設備はBP14のエントリポイントscripts/index.js、個別ブロック定義、4つのレシピを確認しました。BP14/RP18のheader UUID/versionとルートworld登録も照合し、公開用パック一覧へ追加しました。タンク預入・瓶への回収・パイプとバルブの制御はコードの説明です。経験値の収支や本番の互換性・動作は未検証です。

Dungeonsの2件はアイテム定義、RPの日本語名・画像対応を確認しました。武器のダメージ、特殊能力の発動条件、ドロップ、原作と同じ性能は断定していません。

## データと画像

- 新規データ：src/data/field-guide.json。各項目に固定ID、種別、所属、説明、用途、入手条件、確認事項、公開状態、確認commit・相対ソースパス。
- 公開処理：src/lib/field-guide.mjs。publicかつ所属コンテンツが公開中の項目だけを選び、許可したフィールドのみ出力します。確認用ソースパスはHTML/JSに出しません。
- public/images/items/：明示的に選定した38画像をRPからコピー。ゲーム画面とは表示していません。画像がない4設備は画像準備中として表示。
- public/images/xp-storage.svg：経験値ストレージカード用の仮イラスト。実画面ではありません。
- scripts/seed-field-guide.py：今回の初期カタログ作成用。通常のビルドからは呼びません。再実行は手動編集済みデータを置き換えるため、初期データを再作成したい場合だけ使用してください。

## 画面

アイテム一覧では名前・説明の検索、所属コンテンツと種類での絞り込み、URLへの条件反映、0件表示とリセットに対応しています。各コンテンツ詳細に関連項目へのリンクを追加し、アイテムとレシピを相互リンクしています。

確認URL（すべてローカル）：

- http://127.0.0.1:4321/pinene-xserver-addons/database/items/
- http://127.0.0.1:4321/pinene-xserver-addons/database/items/?content=xp-storage
- http://127.0.0.1:4321/pinene-xserver-addons/database/items/?kind=feature
- http://127.0.0.1:4321/pinene-xserver-addons/database/recipes/
- http://127.0.0.1:4321/pinene-xserver-addons/contents/xp-storage/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/mycology-r01/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/craft-xp-pipe/

50項目すべての /database/entries/{id}/ を各画面幅でブラウザ巡回しました。

## 検証・スクリーンショット

- データ検証：50項目、5コンテンツ、10選定パック。ID重複、所属・レシピの参照切れ、材料数と配置表の不一致を検出。
- 型確認：34ファイル、0 errors / 0 warnings / 0 hints。
- production build：65ページ。
- 公開分離・データ異常のテスト：4件成功。
- private/draft識別用データを加えた実ビルドで出力混入を検査し、元データ復元後に再ビルド。
- ブラウザ：Chromium 390 / 768 / 1440px、21件成功。全個別ページのHTTP応答、タイトル、横はみ出し、ローカルリンク・画像、検索とレシピ導線を確認。

[PCのキノコ一覧](artifacts/mushrooms-1440.png) / [スマホのキノコ一覧](artifacts/mushrooms-390.png)

[PCの個別アイテム](artifacts/item-detail-1440.png) / [スマホの個別アイテム](artifacts/item-detail-390.png)

[PCのレシピ](artifacts/recipe-desktop-1440.png) / [スマホのレシピ](artifacts/recipe-mobile-390.png)

## 変更範囲と残る確認

変更はwebsite/のみ。BP/RP実装、UUID、manifest、world登録、ワールド、Xserverには書き込んでいません。

依存バージョンの変更はありません。既存PRに追記し、本番公開・mainへの直接push・mergeは行いません。

ゲーム内での入手・使用・見た目、本番の提供範囲、経験値の収支は未確認です。接続先・参加ルールは未設定、Mob図鑑は引き続き準備中です。残りの候補コンテンツも未確認のまま公開にはしていません。

