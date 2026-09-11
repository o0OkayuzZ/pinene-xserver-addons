# GitHub Pages公開記録

## 現在の公開先：pine-server（2026-09-12）

ユーザー指定により、公開URLを **https://o0okayuzz.github.io/pine-server/** へ移行しました。無限城12項目とMycologyの新しい鑑定案内3項目を追加し、Web全体655項目・680ページを公開しています。

- 実装ソース：`o0OkayuzZ/pinene-xserver-addons` の専用Webブランチ、commit `8af9d2c7`、[PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1)。ゲーム用リポジトリは改名していません。
- 新公開先：`o0OkayuzZ/pine-server` の `gh-pages` / `/`。生成物commit `bd3546c80098a980deab3041c069f8ce03f44685`。[配置実行](https://github.com/o0OkayuzZ/pine-server/actions/runs/34636507527)成功、Pages状態built。
- 旧公開先：`o0OkayuzZ/pinene-xserver-addons` の `gh-pages` に680ページの転送案内。commit `832fa69e8773801d1b0decb3bc4256dec54fa7be`。[転送配置](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34636680390)成功。

新公開URLのホーム、`contents/infinite-castle/`、`contents/mycology/`、`database/entries/castle-return-circle/`、`database/entries/mushroom-reveal-settings/`をChromium 390px・1440pxで開き、HTTP 200、画像、分類展開、詳細リンク、横はみ出しなし、JavaScriptエラーなしを確認しました。新サイト内のリンクに旧baseが混入していないことも確認しています。

旧URLのホーム、`contents/mycology/#guide-brown`、`database/items/?content=mycology`、Dungeonsのハープクロスボウ設計図レシピから、新URLの同一パス・検索条件・フラグメントへ転送することを両画面幅で確認。JavaScript無効でも無限城の同一ページへ転送できることを確認しました（検索条件・フラグメントの引き継ぎはJavaScript有効時）。

[変更・検証・未確認事項](EXPLORATION_URL_REPORT.md) / [無限城PC](artifacts/public-infinite-castle-1440.png) / [無限城スマホ](artifacts/public-infinite-castle-390.png) / [キノコPC](artifacts/public-mycology-1440.png) / [キノコスマホ](artifacts/public-mycology-390.png)。今後の生成物更新は新しい`o0OkayuzZ/pine-server`の`gh-pages`へ行い、旧公開先を通常サイトで上書きしないでください。mainへの直接push・merge、ゲームパックやXserver設定の変更は行っていません。

以下は旧URLで公開していた時点の履歴です。

最新版Dungeonsの更新：ソース `0cfcb6b1`、公開生成物 `5d7120108d71ea556a71371f195b40c684dc8bf9`。main `4a948e25`（Dungeons 2.0.6）との照合と遠距離レシピ32件の追加で、Dungeons454項目、Web全体640項目・665ページになりました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34633490594)は成功。以下の公開URLをChromiumの390px・1440pxで開き、HTTP 200、画像、横はみ出しなし、JavaScriptエラーなし、バージョン2.0.6、32件の展開、設計図の配置表と完成品へのリンクを確認しました。

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-harp-crossbow-blueprint-recipe/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-dual-crossbows-recipe/

[変更・検証・未確認事項](DUNGEONS_LATEST_REPORT.md) / [PC一覧](artifacts/public-dungeons-latest-1440.png) / [スマホ一覧](artifacts/public-dungeons-latest-390.png) / [PC設計図](artifacts/public-dungeons-blueprint-1440.png) / [スマホ設計図](artifacts/public-dungeons-blueprint-390.png)。更新はWeb専用ブランチとPR #1、承認済みのPages生成物に限定。mainへの直接push・merge、ゲームファイルやXserver設定の変更はありません。

Dungeons防具レシピの更新：ソース `7e386484`、公開生成物 `5e1b910`。88件追加、Dungeons422項目、Web全体608項目・633ページになりました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34631977421)は成功。Dungeons紹介、ビーネスト系列の胴装備レシピ、完成品詳細を公開URLで390px・1440px確認済みです。HTTP 200、レシピ88件の展開、詳細リンク、配置表、画像、横はみ出しなし、JavaScriptエラーなしを確認しました。[変更・検証](DUNGEONS_ARMOR_RECIPES_REPORT.md) / [PC画面](artifacts/public-armor-recipes-1440.png) / [スマホ画面](artifacts/public-armor-recipes-390.png)。


Dungeons通常防具の更新：ソース `61a37b74`、公開生成物 `7234c24`。84部位を追加し、Dungeons334項目、Web全体520項目・545ページになりました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34600473478)は成功。Dungeons紹介、所属フィルター312件（レシピを除く）、深緑の脚装備詳細を公開URLで390px・1440px確認済みです。HTTP 200、画像、防具196件の展開、最後の詳細リンク、横はみ出しなし、JavaScriptエラーなしを確認しました。[変更・残数・検証](DUNGEONS_ARMOR_REPORT.md) / [PC画面](artifacts/public-dungeons-armor-1440.png) / [スマホ画面](artifacts/public-dungeons-armor-390.png)。


Dungeons防具・召喚道具の更新：ソース `dba72d9f`、公開生成物 `c7d3d9a`。76件追加、Dungeons250項目、Web全体436項目・461ページになりました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34598132066)は成功。Dungeons紹介、所属フィルター228件（レシピを除く）、魂のランタンのレシピと詳細を公開URLで390px・1440px確認済みです。HTTP 200、画像、防具112件とアーティファクト14件の展開、詳細リンク、横はみ出しなし、JavaScriptエラーなしを確認しました。[変更と検証](DUNGEONS_COMPANIONS_REPORT.md) / [PC画面](artifacts/public-dungeons-companions-1440.png) / [スマホ画面](artifacts/public-dungeons-companions-390.png)。


Dungeons装備の追加更新：ソース `5654af1c`、公開生成物 `06c60ed`。106件を追加し、Dungeons174項目、Web全体360項目・385ページになりました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34597257051)は成功。Dungeons紹介、所属フィルター158件（レシピを除く）、銛の矢レシピ、ウィザーのレギンスを公開URLで390px・1440px確認済みです。HTTP 200、画像、防具48件と弾薬10件の展開、詳細リンク、横はみ出しなし、JavaScriptエラーなしを確認しました。[変更・検証](DUNGEONS_EXPANSION_REPORT.md) / [PC画面](artifacts/public-dungeons-expansion-1440.png) / [スマホ画面](artifacts/public-dungeons-expansion-390.png)。


Minecraft Dungeons優先更新：ソース `e3d89694`、公開生成物 `116135f`。Dungeonsの図鑑を2件から68件へ増やし、Web全体は279ページ・254項目です。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34596199832)は成功。Dungeons紹介、所属フィルター57件（レシピを除く）、英雄の書レシピ、タマゴテングダケ詳細を公開URLで390px・1440px確認しました。HTTP 200、画像読み込み、防具16件の展開、レシピリンク、横はみ出しなし、JavaScriptエラーなしを確認済みです。[今回の変更・検証](DUNGEONS_REPORT.md) / [公開スマホ画面](artifacts/public-dungeons-390.png) / [公開PC画面](artifacts/public-dungeons-1440.png)。


More Geodesの更新：ソース `d5a4a376`、公開生成物 `5ebcec4`。213ページ・図鑑188項目へ更新しました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34556891618)は成功しました。公開URLのMore Geodes紹介、15件に絞り込んだ図鑑、ダイヤモンド結晶詳細を390px・1440pxで開き、HTTP 200、画像読み込み、詳細リンク、横はみ出しなし、JavaScriptエラーなしを確認しました。変更内容とスクリーンショットは[今回の報告](GEODES_REPORT.md)にあります。


収納・死亡回収の更新：ソース `5b86709`、公開生成物 `d85ccac`。197ページ・図鑑173項目へ更新しました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34556064757)が成功。公開URLの冥鉄の箱・Grave紹介と個別アイテムを390px・1440pxで確認し、6つのレシピリンクと配置表への操作、横はみ出しなし、JavaScriptエラーなしを確認済みです。

最新の更新：ソース `e686bd2`、公開生成物 `c6771a9`。Blue Apple・謎の化石・フィギュアを追加し、181ページへ更新しました。[配置実行](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34517189658)は成功し、追加3コンテンツと青りんごの図鑑を公開URLで390px・1440px確認済みです。以下は初回公開時の記録です。

ユーザーからGitHub Pagesでの公開承認を受け、以下を設定しました。過去の実装記録の「本番未公開」は、その記録時点の状態です。

- 公開URL: https://o0okayuzz.github.io/pinene-xserver-addons/
- 公開ソースcommit: `de8027c2bd20860ac2a9a637eae65c71ec4c9cc9`
- 公開元: `gh-pages` ブランチの `/`
- 配信内容: `website/dist/` の166ページと画像・CSS・JavaScript。`.nojekyll`を配置。
- GitHub PagesのHTTPS強制: 有効。
- 配置実行: https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/34515883138

公開直前にデータ検証（147図鑑項目、9コンテンツ、16選定パック）、型確認（エラー・警告0件）、production build（166ページ）、出力監査（178テキストファイル）を実行し、成功しました。

GitHub Pagesの配置ジョブはsuccess、Pages状態はbuiltです。公開URLをChromiumの390px・1440pxで開き、HTTP 200、ホーム画像の読み込み、横はみ出しなし、パンケーキのフィルター5件、個別ページへのリンク、JavaScriptエラーなしを確認しました。

[公開PC画面](artifacts/public-home-1440.png) / [公開スマホ画面](artifacts/public-home-390.png)

公開のためにMinecraftのBP/RP、manifest、UUID、world登録、Xserver設定を変更していません。mainへの直接pushとPRのmergeも行っていません。ソースは既存PR #1のブランチにあり、公開ブランチは生成物専用です。

今後はソース側で検証とbuildを行い、`dist/` の内容を `gh-pages` の履歴を保って更新すると公開されます。ソースへのpushだけでは自動公開しません。公開ブランチにソース・監査用JSON・node_modules・ゲームパックをコピーしないでください。

ゲーム内の動作・提供範囲は未確認、参加URLは未設定です。Webサイトの公開とMinecraftサーバーへの参加設定は別です。

設定方法: [GitHub公式のPages API](https://docs.github.com/en/rest/pages/pages#create-a-github-pages-site)。
