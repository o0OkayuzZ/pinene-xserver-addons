# 青りんご・化石・フィギュアの紹介追加

Blue Apple、謎の化石、フィギュアの紹介ページと図鑑12項目を追加しました。現在は12公開コンテンツ、19選定パック、159図鑑項目、181ページです。ホームの注目4件は維持しています。

## 追加内容・ソース確認

- Blue Apple：青りんご3種、強化レシピ2件、葉からの抽選1件。
- フィギュア：化石・らせん・おゆの3種、設置と回収の説明1件。
- 謎の化石：設置アイテム1件、ブラシを使う調査の説明1件。

図鑑合計の内訳はアイテム・ブロック98件、レシピ49件、機能12件です。

確認commitは `aea85120954a8b74033b86253c17a04b691dab21`。各レコードに確認用相対パスを記録しました。

青りんごはBP03のmanifest、items、recipes、scripts/main.jsを照合しました。別のパックにも同名のアイテムがありますが、今回の説明はresetapple名前空間の定義を対象にしています。葉の破壊イベントでの抽選は0.01%の設定で、木200本で確実に入手できるなどの保証は掲載していません。強化版の大きなnutrition値は設定値として扱い、満腹度の上限を超えて保存できるとは説明していません。

フィギュアはBP15のmain.jsにある実行中の設置・回収処理、BP15/BP06のアイテムと設置用エンティティ、RP02の日本語名とRP05の画像参照を照合しました。攻撃としゃがみ操作の回収経路を説明しています。コード内の旧コメントだけを根拠にしていません。

化石はBP15の設置アイテム・main.jsとBP06のブロック定義を確認しました。ブラシによる操作、抽選、報酬生成、完了時のブロック除去まで追いました。無効な演出設定、実測していない経験値、未監査の自然生成場所は利用可能な情報として掲載していません。

## 変更ファイル

- `src/data/content-registry.json`：3コンテンツの説明と公開設定。
- `src/data/field-guide.json`：12項目。
- `src/data/pack-registry.json`：必要なBP/RPの3パックを追加し、manifestとworld登録を読み取り照合。
- `public/images/blue-apple.svg`、`mystery-fossil.svg`、`figures.svg`：独自の仮イラスト。
- `public/images/items/`：存在する選定画像をRPからコピー。画像本体を確認できないものは準備中。
- `scripts/add-discoveries.py`：今回の追記用。通常ビルドでは実行せず、既存IDがあれば停止します。
- `tests/site.spec.ts`：収集カテゴリの追加後の件数を検証。
- README、各記録、`artifacts/discovery-*.png`。

## 検証・確認先

依存バージョン変更なし。データ検証、型確認（34ファイル・エラーと警告0件）、production build（181ページ）、公開分離テスト4件が成功しました。Chromium 390px・768px・1440pxで21テスト成功。159個別ページを各画面幅で巡回しました。private/draft識別データを投入した実ビルドと復元後の出力検査も成功しました。

確認URL：

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/blue-apple/
- https://o0okayuzz.github.io/pinene-xserver-addons/contents/mystery-fossil/
- https://o0okayuzz.github.io/pinene-xserver-addons/contents/figures/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/blue-apple/

[PCの追加画面](artifacts/discovery-1440.png) / [スマホの追加画面](artifacts/discovery-390.png)

## 反映先と未確認事項

専用ソースブランチとPR #1へ追加し、承認済みのGitHub Pagesへ生成物を更新します。mainへの直接pushやmergeは行いません。

Minecraftのパック、UUID、manifest、world登録、ワールド、Xserverは読み取りのみ。ゲーム内の効果・調査・回収・表示、本番の提供範囲と参加URLは未確認・未設定です。
