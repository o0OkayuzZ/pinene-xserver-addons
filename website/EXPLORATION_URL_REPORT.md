# 無限城・Mycologyの更新と公開URL移行

最新版main `a744ac8a2a32e3837abe8d3150802ec818f68a80`をGitオブジェクトから確認しました。既存のWeb専用ブランチを更新し、ゲームパックの作業ツリーは変更していません。

## 掲載内容

- 無限城：12項目を追加。6種類の戦闘部屋、2段階の戦闘と人数調整、鍵と宝箱、癒やしの庭、宝物庫、帰還陣、再構成と琴の音を掲載しました。
- Mycology：開封演出・長さと音の設定・結果と次のスタックの3項目を追加し、既存の鑑定・発見記録も更新。赤色15種・茶色20種は既に全種類掲載しているため、数を増やさず、最新ソースで変更がないことを確認しました。合計43項目です。
- 両コンテンツに種類別ナビゲーション・画像カード・一覧展開・詳細リンクを追加しました。Mycologyから図鑑の製作レシピへ直接進めます。
- 無限城BP 0.2.4 / RP 0.1.7など、選定パック情報を最新のmanifestとworld登録へ照合しました。両コンテンツの9月12日の配備・起動記録を確認し、ゲーム内操作の確認とは区別して表示しています。
- Dungeons454項目を維持。Web全体655項目（アイテム421・レシピ197・機能37）、680ページです。

## URL

ユーザー指定により公開URLを `https://o0okayuzz.github.io/pine-server/` に移行します。ゲーム用リポジトリ `o0OkayuzZ/pinene-xserver-addons` は改名せず、実装ソースは既存のWeb専用ブランチとPR #1に保持。新しいWeb公開用リポジトリ `o0OkayuzZ/pine-server` の `gh-pages` に生成物だけを置きます。

AstroのbaseとブラウザテストのURLを変更し、出力監査で旧baseが混入しないことも検査します。旧Pagesは各ページから新URLの同じパスへ転送し、検索条件とページ内リンクを引き継ぎます。過去のレポート内の旧URLは当時の記録として保持します。

## 変更ファイル

`src/data/field-guide.json`、`content-registry.json`、`pack-registry.json`、新規`exploration-guides.json`、`src/components/ExplorationGuide.astro`、`src/pages/contents/[id].astro`、`scripts/update-exploration.py`、`validate-guide.mjs`、`check-output.mjs`、`astro.config.mjs`、`playwright.config.ts`、`tests/exploration.spec.ts`と既存3テストのbase、README・実装/公開報告、`artifacts/exploration-audit.json`とスクリーンショット。

## 検証・未確認事項

依存関係は変更なし。データ検証655項目成功、Astro型確認38ファイルでエラー・警告0件、production build 680ページ、公開分離単体テスト4件成功。390px/768px/1440pxのChromium 27テストが成功し、図鑑655ページを各幅で巡回しました。private/draft識別データを入れた実ビルドでも混入なしを確認し、元データで再ビルド済み。出力監査698テキスト資産で旧URL baseも混入していません。

[無限城PC](artifacts/infinite-castle-desktop-1440.png) / [無限城スマホ](artifacts/infinite-castle-mobile-390.png) / [Mycology PC](artifacts/mycology-desktop-1440.png) / [Mycologyスマホ](artifacts/mycology-mobile-390.png)。旧URL転送用の生成スクリプトは`scripts/build-legacy-redirects.mjs`です。転送先を固定し、680ページの各パスに転送ページを生成します。

全6種類の戦闘バランス、報酬の実抽選、帰還の全条件、最新の琴と鑑定演出の実機での聞こえ方・見え方は今回確認していません。実装数値と20 TPS換算を区別しています。入口の場所・参加URL・鑑定士の所在は未設定/案内準備中です。現実のキノコの食用情報や未確認ニュースは追加していません。

## 確認対象

- https://o0okayuzz.github.io/pine-server/
- https://o0okayuzz.github.io/pine-server/contents/infinite-castle/
- https://o0okayuzz.github.io/pine-server/contents/mycology/
- https://o0okayuzz.github.io/pine-server/database/entries/castle-return-circle/
- https://o0okayuzz.github.io/pine-server/database/entries/mushroom-reveal-settings/

公開後の検証、commit・配置実行、PC/スマホの画像は[PUBLISH_REPORT.md](PUBLISH_REPORT.md)に追記します。
