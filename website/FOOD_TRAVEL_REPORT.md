# 食事と移動の図鑑追加

この文書は147項目追加時点の記録です。最新の159項目は [DISCOVERY_REPORT.md](DISCOVERY_REPORT.md) を参照してください。

PancakesとSimple Waystoneのコンテンツ説明を公開し、図鑑に16項目を追加しました。現在は9公開コンテンツ、16選定パック、図鑑147項目、166ページです。ホームの注目4件は維持しています。

## 追加内容

- アイテム7件：パンケーキ生地、パンケーキ、ハニーパンケーキ、ベリーハニーパンケーキ、ワープストーン、金色の羽根、エンチャントされた金色の羽根。
- 作業台レシピ6件：生地、ハニー、ベリーハニーの2経路、羽根2種。
- 小さな機能3件：パンケーキの焼き方、移動先一覧の切り替え、移動の経験値コスト。

合計はアイテム・ブロック91件、レシピ47件、小さな機能9件です。

確認したゲームコードのcommitは `aea85120954a8b74033b86253c17a04b691dab21`。各項目のevidenceに確認用の相対パスを記録し、公開HTMLには出していません。

パンケーキはBP15の個別アイテム・レシピとRP02のアイコンを確認しました。生地はミルク入りバケツ1個・卵4個・小麦4個から16個。調理設備はかまどだけが登録されているため、燻製器・焚き火にも対応するとは紹介していません。

WaystoneはBP11のmanifestからmain.js、events/index.js、startUp.js、listUI.js、teleportItem.js、itemAmount.jsまで処理の接続を確認しました。通常の羽根はクリエイティブ以外で1個減らし、強化された羽根には消費処理がありません。ただし経験値レベルの確認・差引処理は共通で、無料の移動アイテムとは記載していません。待ち時間や具体的な移動先・料金は設定依存のため固定値を掲載していません。

## 変更ファイル

- `src/data/field-guide.json`：16項目を追加。
- `src/data/content-registry.json`：2コンテンツの紹介、分類、確認状況とパック参照。
- `src/data/pack-registry.json`：Simple WaystoneのBP/RPを追加。Pancakesは既存の選定パックを参照。
- `public/images/items/`：選定した7アイテム画像をRPからコピー。
- `public/images/pancakes.svg`、`simple-waystone.svg`：独自の仮イラスト。実ゲーム画面ではないと表示。
- `scripts/add-food-travel.py`：今回の追記用スクリプト。通常のビルドからは実行せず、既存IDがあれば停止します。再利用前にはソースの再監査が必要です。
- README、実装記録、`artifacts/`のPC・スマホ・一覧画面。

## 検証

依存バージョンは変更していません。データ検証は147項目・9公開コンテンツ・16選定パックで成功。型確認は34ファイルでエラー・警告0件、production buildは166ページで成功しました。

公開分離テスト4件と、private/draft識別用データを投入した実ビルド・復元後の実ビルドの出力検査が成功しました。Chromium 390px・768px・1440pxで21テスト成功。147個別ページの表示・横はみ出し・リンク・画像と、一覧の検索・フィルター・リセット操作を確認しました。

実際に確認したURL（ローカル）：

- http://127.0.0.1:4321/pinene-xserver-addons/contents/pancakes/
- http://127.0.0.1:4321/pinene-xserver-addons/contents/simple-waystone/
- http://127.0.0.1:4321/pinene-xserver-addons/database/items/?content=pancakes
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/craft-pancake-batter/
- http://127.0.0.1:4321/pinene-xserver-addons/database/entries/waystone-enchanted-golden-feather/

[PCのパンケーキ一覧](artifacts/pancakes-1440.png) / [スマホのパンケーキ一覧](artifacts/pancakes-390.png)

[PCの移動アイテム](artifacts/travel-1440.png) / [スマホの移動アイテム](artifacts/travel-390.png)

## 未確認事項・反映先

ゲーム内クラフト・食事・移動・表示、実際の経験値収支、移動失敗時の扱い、本番の設置先と提供状況は未確認です。参加URLは未設定です。

変更はwebsite/のみ。BP/RP・UUID・manifest・ワールド・読み込み順・Xserverには書き込んでいません。専用ブランチ `web/pine-server-refresh-20260911` でcommitし、[PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1)へ反映します。mainへの直接push・自動merge・本番公開は行いません。
