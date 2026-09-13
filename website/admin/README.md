# PINE SERVER 本人用管理画面

`node server.mjs`で127.0.0.1:18473だけに起動します。通常はデスクトップの「PINE SERVER 管理画面」を開いてください。秘密の起動キーはURLのフラグメントから受け取り、APIのBearer認証に使用します。認証キー・設定ファイルはLocalAppData配下に置き、Gitへ保存しません。GA4サービスアカウントとCloudflare APIキーはWindows DPAPIで暗号化保存します。

## 初回の接続

1. Google AnalyticsでPINE SERVER専用のGA4プロパティ・Webデータストリームを作成します。
2. 測定ID（G-から始まる公開用ID）と数字のプロパティIDを管理画面に入力します。拡張計測はスクロール・離脱クリック・動画・ダウンロードをON、サイト内検索・フォームの操作・ページビュー詳細の「ブラウザの履歴イベントに基づくページの変更」をOFFにします。ページ表示はサイトが明示的に送信します。拡張計測ではリンク先URLや動画情報も送られます。公開リンクに秘密情報や個人情報を含めないでください。
3. Google CloudでAnalytics Data APIを有効にし、サービスアカウントを作成します。そのメールアドレスにGA4プロパティの閲覧者権限を付け、JSONキーをローカル管理画面へ入力します。キーはチャット・公開Git・スクリーンショットへ含めないでください。
4. 管理画面で保存・更新し、読み取りを確認します。測定IDだけを`src/data/analytics-config.json`へ設定してenabledをtrueにし、通常のWeb検証・専用ブランチpush・pine-serverへの配置を行うと計測を開始できます。接続設定の保存だけではWebを自動公開しません。
5. 訪問者は計測の許可を選べます。許可するまでGoogleのスクリプトは読み込まず、拒否してもサイト機能は使えます。

## 表示する内容

公開WebではGA4とCloudflareを併用しています。`provider: ga4`でも有効な`cloudflareBeacon`があれば基本集計を読み込みます。CloudflareはGA4の同意とは独立し、GA4は許可時だけ動作します。この公開トークンだけでは管理画面から統計を読み取れません。Cloudflare側の集計はCloudflareにログインして確認できます。ローカルUIは接続設定で選択したサービスを表示する方式で、両サービスの人数を合算しません。

ページ表示・セッション・アクティブユーザー・新規ユーザー・平均セッション時間・エンゲージメント率、日別・人気ページ・コンテンツ・イベント・ページ別イベント・流入元・入口ページ・端末・国・ブラウザ・OS・時間帯を表示します。分類取得に失敗した場合は「取得できない」とし、ゼロへ置き換えません。最大1,000行とその中の割合を表示します。操作件数をファネル・同一人物の移動順として扱いません。

`pine_search`（検索使用・文章は送らない）、`pine_filter`、`pine_expand`、`pine_recipe_view`、`pine_item_view`、`pine_guide_open`、`pine_content_open`、`pine_join_open`を計測します。対象イベントのページURL・コンテンツグループは標準のGA4軸で確認できます。さらに細かいパラメータ分析にはGA4でカスタム定義を登録してください。

## GitHub

集計保存先は本人のprivateリポジトリ`o0OkayuzZ/pine-server-stats`、reportsブランチのREADMEです。保存のたびにprivateと所有者をAPIで検査します。APIキーやサービスアカウントは送らず、集計した表だけを送ります。定期実行は未設定で、管理画面の「GitHubへ保存」で更新します。GitHubの標準Trafficはコードのリポジトリ閲覧で、公開Webの閲覧とは別表示です。

## 検証・資料

2026-09-13: 保存済みの読み取り専用設定でCloudflareの実集計取得、390px・768px・1440pxでの管理画面表示、privateリポジトリへの保存を確認しました。実データのスクリーンショットはローカルの管理データフォルダーに保存し、このリポジトリには含めません。GA4 Data APIの接続は別途必要です。CloudflareはサイトID・期間・対応時は`/pine-server/`のパスで絞ります。ダッシュボードURLの`excludeBots=Yes`はAPIに引き継いでいないため、同じ期間でもダッシュボードと値が異なる場合があります。

Cloudflareの同名Settings項目を除外してデータセットを探索し、名前が空の型ラッパーと任意項目の欠落に対応しました。生成クエリの閉じ括弧も修正し、回帰テストを含む管理画面の10テストが通っています。

`npm test`は権限境界、値の検証、取得対象フィルター、レポート出力を確認します。実アカウントが未接続の場合、Google/Cloudflareの認証成功や本物の訪問集計は未確認です。数値の例を実データとして表示しません。

- [GA4 Data APIの指標](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema)
- [GA4 runReport](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport)
- [Googleサービスアカウント認証](https://developers.google.com/identity/protocols/oauth2/service-account)
- [Cloudflare APIのスキーマ探索](https://developers.cloudflare.com/analytics/graphql-api/features/discovery/introspection/)
- [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/about/)
- [GitHub Traffic](https://docs.github.com/en/repositories/viewing-activity-and-data-for-your-repository/viewing-traffic-to-a-repository)
