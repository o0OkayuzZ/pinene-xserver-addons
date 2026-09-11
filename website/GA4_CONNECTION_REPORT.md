# GA4測定IDの接続（2026-09-12）

ユーザーから受領した公開用測定ID `G-11K0Q4T42N` を設定し、訪問者が許可した場合だけGoogleタグを読み込む構成を有効化しました。デスクトップ管理画面・GitHubレポートの読み取り用認証とは別の設定です。プロパティIDとサービスアカウントの設定、GA4管理画面での実集計確認は未完了です。

## 変更

- `src/data/analytics-config.json`：公開用測定IDとenabledを設定。
- `src/pages/privacy.astro`：拡張計測の対象とリンク先URL・動画情報等の送信を説明。
- `admin/README.md`、`admin/ui/index.html`：拡張計測を項目別に設定する手順へ更新。スクロール・離脱クリック・動画・ダウンロードをON、サイト内検索・フォーム・履歴変更の自動ページビューをOFFにします。
- `admin/ui/app.js`：拡張イベントの日本語名を追加。
- `tests/analytics.spec.ts`：生成された実ページで測定ID・同意・取り消し・ページ表示1件・検索条件の除外を検証。
- `scripts/check-ga-tag.mjs`：実Googleタグの通信内容を確認する手動検証。計測先への送信は遮断し、架空の訪問数を作りません。

## 検証

データ検証成功（655項目）。型確認50ファイルでエラー・警告なし。production build 681ページ。390px・768px・1440pxの計測ブラウザテスト6件、公開分離テスト4件、管理ロジック9件成功。

実Googleタグをローカルプレビューで読み込み、同意前の読み込みなし、同意後のタグ読み込み1回、`page_view`が1件、`scroll`と`pine_search`が指定ID宛てに生成されることを確認。ページURLのquery/fragmentと検索文のテスト文字列は収集リクエストに混入しませんでした。収集リクエストはブラウザで遮断しており、GA4での受信・集計成功を示す検証ではありません。動画・ダウンロード・外部リンクの実操作別通信は未確認です。

[PCの同意画面](artifacts/analytics-consent-1440.png) / [スマホの同意画面](artifacts/analytics-consent-390.png)。表示には横はみ出しがありません。

設定の根拠：[Googleのページビュー送信仕様](https://developers.google.com/analytics/devguides/collection/ga4/views?hl=ja)、[拡張計測の対象](https://support.google.com/analytics/answer/9216061?hl=ja)。
