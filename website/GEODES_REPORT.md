# More Geodesの紹介追加

More Geodesの紹介と15図鑑項目を追加しました。現在は15公開コンテンツ、22選定パック、188図鑑項目、213ページです。

- ダイヤモンド・エメラルド・ローズクォーツの設置用アイテムを各4種類、計12件。
- 各系列のジオード生成設定を計3件。

図鑑全体はアイテム・ブロック114件、レシピ55件、機能19件です。ホームの注目4件は維持しています。

## 確認内容

確認commitは `aea85120954a8b74033b86253c17a04b691dab21`。BP07の個別アイテムとblock_placerの設置先、ブロック定義、feature_rulesからfeaturesへの参照、RP04の日本語名・アイコンを照合しました。

生成候補のY=-30〜30は高さの設定で、確実な入手場所や空洞全体の範囲としては紹介していません。ダイヤモンドとエメラルドは外側が黒曜石、ローズクォーツは滑らかな玄武岩という違いを反映しています。中間層はいずれも方解石です。

結晶ブロックの基本ドロップ参照がempty.jsonであるため、採掘による鉱石の獲得、シルクタッチ対応、成長速度などは未確認として扱います。設置用アイテムがあることと、サバイバルで入手できることは区別しています。

## 変更ファイル

- `src/data/field-guide.json`：15項目。
- `src/data/content-registry.json`：More Geodesの説明・公開設定。
- `src/data/pack-registry.json`：BP07/RP04の2パックを追加し、manifestとworld登録を読み取り照合。
- `public/images/items/geode-*.png`：RP04から選定画像12枚をコピー。
- `public/images/more-geodes.svg`：独自の仮イラスト。実画面ではないと表示。
- `scripts/add-geodes.py`：今回の追記補助。ビルドでは実行せず、既存IDがあれば停止します。再利用時はソースの再監査が必要です。
- README、実装記録、`artifacts/geodes-*.png`。

## 検証

依存バージョン変更なし。データ検証、型確認（34ファイル・エラーと警告0件）、production build（213ページ）、公開分離テスト4件が成功しました。Chromium 390px・768px・1440pxの21テストで188個別ページを各幅で巡回しました。private/draft識別データを投入した実ビルドと復元後の出力監査も成功しました。

確認URL：

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/more-geodes/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/items/?content=more-geodes
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/geode-diamond-cluster/

[PCの結晶一覧](artifacts/geodes-1440.png) / [スマホの結晶一覧](artifacts/geodes-390.png)

## 反映先・未確認事項

Web専用ブランチとPR #1へ追加し、承認済みのGitHub Pagesへ生成物を更新します。ゲームパック、UUID、manifest、読み込み順、ワールド、Xserverは変更しません。青りんご統一のゲーム用PR #2とは独立したWeb更新です。

実ゲームの生成・入手・設置・成長・表示は未確認です。参加URLは未設定です。
