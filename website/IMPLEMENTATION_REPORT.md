# PINE SERVER Web 実装・検証記録

以下は初回実装の記録です。現在は166ページ・図鑑147項目に拡張しています。最新の追加範囲・検証は [FOOD_TRAVEL_REPORT.md](FOOD_TRAVEL_REPORT.md) を参照してください。

2026-09-11 JST。取得時main: `aea85120954a8b74033b86253c17a04b691dab21`。
作業ブランチ: `web/pine-server-refresh-20260911`。

## 実装

取得したmainにはwebsite/も.github/workflows/も存在しなかったため、引き継ぎZIPのstarter/website/を土台に作成しました。START_HERE.md、CODEX_PROMPT.md、DESIGN_SPEC.md、CONTENT_AND_SAFETY.md、SOURCE_AUDIT.mdを読み、reference/homepage-approved-direction.pngを実際に開いて確認しました。

黒いヘッダー、明るい独自の仮風景、白〜薄灰色の本文、角張った緑の立体ボタン、画像中心のカードを実装しています。正式表記はPINE SERVER。注目4件は設定から選び、PvP Islandと無限城は別ページです。

14ページを静的生成します。ホーム、コンテンツ検索・カテゴリ絞り込みと0件からの復帰、4件の詳細、参加案内、更新情報、パック一覧、図鑑入口とItems/Mobs/Recipes、404があります。モバイルメニュー、Escapeでの閉じ操作、フォーカス表示、画像欠落時の代替表示、プロジェクトbase付きURLを実装しています。

## 変更ファイル

変更はすべてwebsite/配下です。既存のBP/RP・manifest・UUID・world登録・ワールド・Xserver設定・読み込み順・既存作業は変更していません。長いパスの既存cloneでGitが失敗したため、別の短いパスへcloneして作業しました。元の作業をstash/resetしていません。

- `src/layouts/BaseLayout.astro`、`src/styles/global.css`、`src/site.config.ts`: 共通デザイン・ナビ・SEO・設定
- `src/pages/index.astro`、`src/pages/contents/index.astro`、`src/pages/contents/[id].astro`
- `src/pages/start.astro`、`src/pages/updates.astro`、`src/pages/packs.astro`、`src/pages/404.astro`
- `src/pages/database/{index,items,mobs,recipes}.astro`
- `src/components/{ContentCard,StatusBadge}.astro`
- `src/lib/{data.ts,public-data.mjs,public-data.d.mts}`: 公開レコードと許可フィールドの選別
- `src/data/{content-registry,pack-registry,updates}.json`: 確認済み4件とdraft候補、選定8パック、空のニュース
- `public/images/{landscape,pvp-island,infinite-castle,minecraft-dungeons,mycology,pine}.svg`、`public/images/og.png`
- `scripts/{validate-data,check-output,publication.test,test-build-publication,preview-test,render-og}.mjs`、`scripts/refresh-audit.py`
- `tests/site.spec.ts`、`playwright.config.ts`
- `astro.config.mjs`、`package.json`、`package-lock.json`、`tsconfig.json`、`src/env.d.ts`、`.gitignore`
- `README.md`、本記録、`audit/SOURCE_AUDIT.md`、`audit/source-evidence.json`、`artifacts/*.png`

## 検証

| 確認 | 結果 |
|---|---|
| Node / npm | 24.21.0 / 11.19.0 |
| 依存 | Astro 7.3.2、TypeScript 5.9.3、@astrojs/check 0.9.10、Playwright 1.63.0、@types/node 24.13.4を固定 |
| npm ci --no-fund | 成功。監査結果0 vulnerabilities |
| npm run validate | 成功。4 public contents / 8 selected packs / 0 public updates。固定件数を要件にはしていない |
| npm run test:publication | 2件成功。非公開・ネストした管理情報・参照の除外と重複/参照切れ検出 |
| npm run check | 28ファイル、0 errors / 0 warnings / 0 hints |
| npm run build | 成功。14ページ |
| node scripts/test-build-publication.mjs | private/draftの識別用ダミーを実ビルドに投入し、出力に混入しないことを確認。元データ復元後に再ビルド成功 |
| node scripts/check-output.mjs | 21個のテキスト出力を検査。draft URL、旧ブランド、raw JSON、source map、ローカル絶対パスなし |
| npm test | Chromiumで390 / 768 / 1440px、15件成功 |
| 目視確認 | 3サイズのホーム画像を実際に開いて確認 |

ブラウザ試験は検索、全角英字の正規化、カテゴリ付きURL、0件表示、リセット、詳細リンク、技術情報の展開、パック絞り込み、メニューのEnter/Escape、スキップリンク、全公開ページの横はみ出し、画像とリンク、画像欠落時の代替表示を確認しています。ブラウザはChromiumです。実機Minecraft内ブラウザ、Safari、Firefoxは未確認です。

検証中に見つかった日本語パスのOG保存エラー、テスト用Node型定義不足、Astro CLIの自動バックグラウンド化によるテストサーバー起動問題は修正済みです。npmはesbuildのinstall-script承認に関する警告を出しましたが、lockfileからのインストールとproduction buildは成功しています。

## 実際に確認したURL

起点: http://127.0.0.1:4321/pinene-xserver-addons/

ブラウザで以下を確認しています。

- `/pinene-xserver-addons/`
- `/pinene-xserver-addons/contents/`
- `/pinene-xserver-addons/contents/?category=collection`
- `/pinene-xserver-addons/contents/{pvp-island,infinite-castle,minecraft-dungeons,mycology}/`
- `/pinene-xserver-addons/start/`
- `/pinene-xserver-addons/updates/`
- `/pinene-xserver-addons/packs/`
- `/pinene-xserver-addons/database/`
- `/pinene-xserver-addons/database/{items,mobs,recipes}/`
- `/pinene-xserver-addons/404.html`
- ページ内の全ローカルリンク・画像・CSS・JS、`/pinene-xserver-addons/images/og.png`

astro.configのhttps://o0OkayuzZ.github.ioはSEO URL生成用です。公開サイトをデプロイ・閲覧確認したという意味ではありません。

## スクリーンショット

- [PC ホーム 1440px](artifacts/home-desktop-1440.png)
- [タブレット ホーム 768px](artifacts/home-tablet-768.png)
- [スマホ ホーム 390px](artifacts/home-mobile-390.png)
- [PC 一覧](artifacts/contents-desktop-1440.png)
- [タブレット 一覧](artifacts/contents-tablet-768.png)
- [スマホ 一覧](artifacts/contents-mobile-390.png)

## 未確認・未設定

接続先、ポート、招待URL、参加ルール・連絡先は未提供です。架空の参加リンクは置いていません。ニュースは0件、アイテム/Mob/レシピ図鑑と実画面ギャラリーは準備中です。画像は独自の仮SVGイラストであり、ゲーム内の再現画像ではありません。実素材・確認済みコンテンツデータへの差し替えが必要です。

manifest/world登録の一致はリポジトリでの確認に限ります。本番配備、サーバー起動、ゲーム内の操作・表示、未確認の能力・入手方法・隠しTier・報酬は検証していません。残りの候補コンテンツの分類はdraftです。

## Gitと公開

このブランチのcommitとPRでレビューする構成です。mainへの直接push、自動merge、本番公開、Pages workflowの変更は行っていません。commit SHAとPR URLは作業完了時の報告に記載します。
