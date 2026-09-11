# 収納と死亡回収の紹介追加

冥鉄の箱とGrave / 死亡回収の紹介を公開対象にし、図鑑14項目を追加しました。現在は14コンテンツ・20選定パック・173図鑑項目・197ページです。

- アイテム・ブロック4件：冥鉄の箱、墓の鍵2種、墓の見た目設定キー。
- レシピ6件：冥鉄の箱の金インゴット位置が異なる6配置。材料はチェスト1・ネザライトインゴット2・金インゴット1で共通です。
- 機能4件：箱の合言葉、箱の回収、墓の外観、墓の鍵と利用条件。

全体はアイテム・ブロック102件、レシピ55件、機能16件です。ホームの注目4件は維持しています。

## ソース照合

確認元のゲームコードcommitは `aea85120954a8b74033b86253c17a04b691dab21`。BP15のmain.jsからmeitetsu_chest.jsへのimport、箱のブロック・27枠の収納エンティティ・6レシピ、管理者登録・合言葉設定・管理画面を確認しました。合言葉の保護性能や収納の完全性を実証したものとは記載していません。

GraveはBP06のmanifest、main.js、functions.js、鍵と見た目設定アイテムを照合しました。`new:key`は使用時の座標移動対象、`new:key2`はその対象外です。両者を同じ機能として紹介していません。鍵の付与や開錠条件は設定依存です。管理者用マスターキー・設定変更用アイテムは一般向け図鑑へ追加していません。

各項目に確認ファイルの相対パスを記録し、公開出力には含めていません。今回のWeb更新は、別PR #2の青りんご統一をゲームサーバーへ反映したという意味ではありません。

## 変更ファイル

- `src/data/field-guide.json`：14項目。
- `src/data/content-registry.json`：2コンテンツ。
- `src/data/pack-registry.json`：GraveのRPを選定一覧に追加。manifestとworld登録を読み取り照合。
- `public/images/meitetsu-chest.svg`、`grave.svg`：独自の仮イラスト。
- 鍵画像の参照先にPNG本体がなく、設定キーのアイコンもRP内に参照定義がないため、アイテム画像は準備中として表示。
- `src/pages/database/entries/[id].astro`：複数の関連レシピを縦のリストにし、6つのリンクを選びやすく調整。
- `scripts/add-storage-grave.py`：確認済み項目の追記補助。ビルドでは実行せず、既存IDがあれば停止します。
- README、実装記録、`artifacts/storage-*.png`、`artifacts/grave-*.png`。

## 検証

依存バージョン変更なし。データ検証（173項目）、型確認（34ファイル・エラーと警告0件）、production build（197ページ）、公開分離テスト4件が成功しました。Chromium 390px・768px・1440pxで21テスト成功し、173個別ページを各幅で巡回しました。private/draft識別データを投入した実ビルドと復元後の出力監査も成功しました。

追加後の確認URL：

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/meitetsu-chest/
- https://o0okayuzz.github.io/pinene-xserver-addons/contents/grave/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/meitetsu-chest/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/grave-key/

[PCの収納紹介](artifacts/storage-1440.png) / [スマホの収納紹介](artifacts/storage-390.png)

[PCの墓の鍵](artifacts/grave-1440.png) / [スマホの墓の鍵](artifacts/grave-390.png)

## 反映先・未確認事項

Web専用ブランチとPR #1へ反映し、承認済みのGitHub Pagesへ生成物を更新します。変更はwebsite/と公開生成物のみ。ゲームパック、UUID、manifest、読み込み順、ワールド、Xserverは変更しません。

実ゲームでの収納・回収・移動・表示、アイテムの収支、保存データの永続性、本番の提供範囲は未確認です。参加URLは未設定です。
