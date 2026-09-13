# Cloudflare基本集計の追加（2026-09-12）

ユーザー提供の公開用トークンを`src/data/analytics-config.json`へ設定しました。`src/components/Analytics.astro`はCloudflareをGA4の同意とは独立して読み込み、GA4は従来どおり許可後のみ読み込みます。サイト全体の基本集計と、許可した訪問者の詳細な操作分析を分けて使う構成です。全訪問者を100%記録するものではありません。

`src/pages/privacy.astro`と同意案内に両サービスの違いを追記し、`scripts/validate-data.mjs`で併用時のCloudflareトークンも検証します。`admin/README.md`に接続と表示の違いを説明しました。管理UIは接続設定で選んだサービスを表示し、両サービスの人数を足しません。

## 検証

- データ検証：655項目、15コンテンツ、22パック。成功。
- 型確認：51ファイル、エラー・警告なし。production build：681ページ。
- 390px・768px・1440pxで計測関連ブラウザテスト9件成功。Cloudflareが同意前・GA4拒否後とも1ページにつき1回読み込まれ、GA4は許可後のみ読み込まれることを確認。
- 公開分離テスト4件成功。
- 実Cloudflareスクリプトをローカルプレビューで読み込み、ホームと計測説明から指定トークンの収集リクエストが生成されることを確認。テストURLの検索文字列は送信内容に含まれず、GA4の読み込みとJavaScriptエラーは0件でした。Cloudflareへの収集リクエストは遮断しており、テストの訪問を実データに加えていません。

## 残る接続と確認

Cloudflare管理画面での受信・集計表示は未確認です。公開用トークンではデータの読み取りはできず、本人用管理画面・GitHubレポートへの取得には、アカウントID・サイトID・読み取りAPIトークン等の設定が必要です。秘密キーはチャットやGitに貼らずローカル管理画面へ入力します。

[Cloudflare公式の設置手順](https://developers.cloudflare.com/web-analytics/get-started/)。MinecraftのBP/RPやXserver設定は変更していません。

## 公開確認

ソースcommit 4b19d0ec、公開生成物46abd28dbfbdad8e0696d5074451a088501e29f8。[Pages配置](https://github.com/o0OkayuzZ/pine-server/actions/runs/34653546899)成功。[ホーム](https://o0okayuzz.github.io/pine-server/)と[計測説明](https://o0okayuzz.github.io/pine-server/privacy/)を390px・768px・1440pxで開き、HTTP 200、CloudflareとGA4の独立した同意動作、横はみ出しなし、JavaScriptエラーなしを確認しました。公開ブラウザ確認では外部タグをモックし、テスト訪問は収集先へ送りませんでした。

[PC画面](artifacts/cloudflare-consent-1440.png) / [スマホ画面](artifacts/cloudflare-consent-390.png)。
