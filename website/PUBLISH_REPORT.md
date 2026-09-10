# GitHub Pages公開記録

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
