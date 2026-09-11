# GitHub Pages公開記録

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
