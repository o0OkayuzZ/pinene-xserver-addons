# PINE SERVER 本人用アクセス管理画面

> 更新：GA4測定IDの設定と公開が完了しました。以下の未接続・計測OFFの記録は接続前の履歴です。読み取り用API認証とGA4管理画面での実集計確認は未完了です。[最新の接続・公開検証](GA4_CONNECTION_REPORT.md)。

ユーザーは本人だけが見られる管理画面、デスクトップの起動アイコン、詳細な操作分析のためのGA4を選択しました。Cloudflareだけではなく、GA4を主に使う構成へ進めています。

## 実装

- `admin/`にNode.js標準機能だけで起動するローカル管理画面を追加しました。追加のnpm依存はありません。127.0.0.1:18473でのみ待受し、ランダムな起動キー・Host・Originを確認します。LANや公開Pagesには管理APIを置きません。
- 期間選択、6つの指標カード、日別グラフ、11種類の詳細表、表の検索・追加表示・CSV/JSON保存、GitHub非公開レポートへの保存を用意しました。未設定・取得失敗・データなしを区別し、未接続を0人に置き換えません。
- GA4 Data APIは公開ホストと`/pine-server/`のパスを限定して読み取ります。アクティブ/新規ユーザー、セッション、時間、関与率、日別・ページ・コンテンツ・イベント・ページ別イベント・流入元・入口・端末・国・ブラウザ・OS・時間帯を取得するアダプターを実装しました。指標の定義はGA4準拠で、個人の実名一覧ではありません。
- Cloudflare用の読み取りも残しました。認証後にGraphQLスキーマを確認し、サイトと期間を限定できない場合は取得を止めます。APIキーとサービスアカウントJSONはLocalAppDataの専用フォルダーへWindows DPAPIで暗号化保存し、Gitやブラウザへの設定返却には含めません。
- デスクトップに「PINE SERVER 管理画面」のショートカットを設置し、実際に起動しました。起動用キーをショートカット本体へ埋め込まず、Node補助プロセスは非表示で起動します。
- `o0OkayuzZ/pine-server-stats`をprivateで作成し、reportsブランチに本人用レポートを保存しました。保存の直前にもprivateと所有者を検査します。自動の定期集計は設定していません。管理画面の更新・GitHub保存ボタンで更新します。
- 公開Webには、設定後に有効化できるGA4計測コードと計測説明ページを追加しました。訪問者が許可するまではGoogleのスクリプトを読み込みません。独自イベントは検索使用・絞り込み・展開・アイテム/レシピ閲覧・図鑑詳細/コンテンツ/参加案内クリックです。検索文やURLのquery/fragmentは独自イベントへ渡しません。

## 接続前の状態

**GA4の実アカウントは未接続で、公開計測はenabled:falseです。** 測定ID・プロパティID・読み取り用サービスアカウントが必要です。ローカル画面から接続設定を入力できます。GA4側の拡張計測機能をOFFにし、独自イベント以外の検索文字列等の自動送信を止める手順も案内しています。測定IDの公開・実アカウントへの認証・実訪問の集計確認は未完了です。導入前の訪問は復元できません。

日別や操作別の数値は同一人物の経路ではありません。ファネルや経路の詳細はGA4の探索画面で設定します。集計に遅延・しきい値・行数上限がある場合があり、APIの最大1,000行に達すると一部表示であることを明記します。

## 検証

管理ロジック単体9件成功。認証・Windows DPAPIの暗号化/復号・ID検証・秘密の設定保持・公開ホスト/パス限定・欠損値・GA4アダプター・失敗した内訳の扱い・GitHubレポートの公開対象を確認しました。管理画面は390px/768px/1440pxで実際の未接続状態・設定切替・認証なし403・横はみ出しなし・JavaScriptエラーなしを確認。別途、テスト専用の合成レスポンスでグラフ・絞り込み・CSV・操作名・未取得内訳を検証しました。合成値はGitHubや本番スクリーンショットには使用していません。

公開Webの型確認はエラー・警告0件、production build 681ページ、公開分離単体4件と識別データを入れた実ビルドの混入検査が成功。出力700テキスト資産を確認し、管理API・秘密の接続設定は公開されません。3画面幅の30ブラウザテストも成功し、GA4の許可前の読み込みなし・拒否・許可・取り消し・検索文を送らない独自イベントを確認しました。管理画面経由でGitHubへの保存が成功し、未認証のGitHubアクセスは404であることも確認しました。

## ファイル・URL・画像

実装commitは `d2f4178d`、[PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1)に反映済みです。公開生成物 `4342a8b275ed3b1b790747326e0b2c8773506d15` の[配置](https://github.com/o0OkayuzZ/pine-server/actions/runs/34639312184)は成功しました。実際の [ホーム](https://o0okayuzz.github.io/pine-server/) と [計測説明](https://o0okayuzz.github.io/pine-server/privacy/) を390px・1440pxで確認し、HTTP 200、横はみ出しなし、JavaScriptエラーなし、計測通信なしでした。公開先の `admin/server.mjs` と `api/state` は404です。GA4の実認証・実データの取得は引き続き未確認です。

主な変更は`admin/`、`src/components/Analytics.astro`、`src/data/analytics-config.json`、`src/layouts/BaseLayout.astro`、`src/pages/privacy.astro`、`public/analytics.js`、`scripts/validate-data.mjs`、`tests/analytics.spec.ts`、この報告とスクリーンショットです。公開コンテンツ655項目は維持しています。

- 本人用ローカルUI：デスクトップの「PINE SERVER 管理画面」から起動（127.0.0.1:18473、起動キーが必要）。
- 本人用GitHub：[pine-server-stats](https://github.com/o0OkayuzZ/pine-server-stats)。ログインが必要です。
- [PCの実画面](artifacts/admin-1440.png) / [スマホ幅](artifacts/admin-390.png) / [タブレット幅](artifacts/admin-768.png)
- 設定と公式資料：[admin/README.md](admin/README.md)

MinecraftのBP/RP・UUID・manifest・ワールド・Xserver設定には触れていません。mainへの直接pushや自動mergeは行いません。
