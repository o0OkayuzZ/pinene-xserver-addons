# Dungeons 防具製作レシピ

防具の配置付きレシピ88件を追加しました。22系列・88部位の材料と配置、完成品の説明を相互リンクで確認できます。Dungeonsは422項目（アイテム309・レシピ110・機能3）、Web全体は608項目（アイテム421・レシピ165・機能22）、633ページです。

## 変更ファイル

- `src/data/field-guide.json`：防具レシピ88件、完成品の入手説明・レシピ根拠を追加。
- `src/data/dungeons-guide.json`：8つ目の分類「防具の製作レシピ」。最初の4件と残り84件を展開する一覧。
- `src/data/content-registry.json`：製作レシピの紹介。
- `scripts/add-dungeons-armor-recipes.py`：今回の登録用。ゲーム側は読み取り専用で、同じ分類があれば停止します。
- `tests/dungeons.spec.ts`：88件の展開、ハチの巣系列の胴装備の材料、完成品との往復リンクを追加検証。
- README・実装記録・公開記録、Dungeonsのスクリーンショット、`artifacts/dungeons-remaining-audit.json`。

## コードの照合

根拠commitは`aea85120954a8b74033b86253c17a04b691dab21`。BP08の`recipes/armor/`にある88ファイルすべてについて、作業台タグ、配置文字と材料、完成品ID・完成数を照合しました。完成品が公開済みのDungeonsアイテムであることを確認しています。

ハチの巣系列のチェストプレートはハニカム7個とミツバチの巣1個を使用します。名前から通常の防具配置へ置き換えず、部位ごとに異なる材料を保持しました。元データでバニラ名前空間が省略された`bee_nest`と`bone`は材料名を対応させています。定義のない材料キー、未知の材料、公開されていない完成品があれば登録処理を止めます。

追加後、未掲載アイテムは176定義、未掲載レシピは158ファイルです。レシピの残りは近接武器76・遠距離武器46・アーティファクト24・ブロック8・その他4です。旧版・限定品・入手不可品などを含む数であり、すべてを公開できることを意味しません。

## 検証

依存変更なし。データ検証成功、型確認35ファイルでエラー・警告0件、production build 633ページ、公開分離テスト4件成功。390px・768px・1440pxのChromiumで全608図鑑ページを巡回する24テストが成功しました。88件の一覧展開、ハニカム7個とミツバチの巣1個の表示、完成品との往復リンクも確認しました。

private/draft識別データを投入した実ビルドと復元後ビルドの出力監査が成功。Dungeons422項目の一覧への重複のない掲載と根拠ファイルの存在を照合しました。ゲーム側ファイルは根拠commitから変更されていません。

[PC全体](artifacts/dungeons-desktop-1440.png) / [スマホ全体](artifacts/dungeons-mobile-390.png) / [タブレット全体](artifacts/dungeons-tablet-768.png)

## 確認対象URL

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-beenest-chestplate-recipe/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-beenest-chestplate/

公開先の最終確認とcommitは[PUBLISH_REPORT.md](PUBLISH_REPORT.md)に記録します。

実ゲームでの製作・解放表示、左右反転の受付、装備性能や入手操作は未検証です。参加URLは未設定、紹介の大きなイラストは仮素材です。Web以外のゲームパック、UUID、manifest、ワールド、読み込み順、Xserver設定は変更しません。専用WebブランチとPR #1を更新し、mainへの直接push・自動mergeは行いません。
