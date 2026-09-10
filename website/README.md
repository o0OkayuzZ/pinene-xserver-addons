# PINE SERVER website

Astro + TypeScriptによる、PINE SERVERのコンテンツ紹介サイトです。現行mainにwebsite/がなかったため、引き継ぎZIP v0.2のstarter/website/を土台として更新しました。

現在はアイテム・ブロック84件、レシピ41件、小さな機能6件、合計131件を掲載しています。最新の追加内容と検証は [CRAFTING_REPORT.md](CRAFTING_REPORT.md) を参照してください。

## 起動・検証

Node.js 22.12以上の対応する偶数系リリースを使用してください。今回の検証環境はNode 24.21.0 / npm 11.19.0です。

```sh
cd website
npm ci
npm run validate
npm run test:publication
npm run check
npm run build
npx playwright install chromium
npm test
node scripts/test-build-publication.mjs
npm run preview -- --host 127.0.0.1 --port 4321
```

ローカルURL: http://127.0.0.1:4321/pinene-xserver-addons/

Astro 7のCLIはエージェント環境でpreviewを自動的にバックグラウンド起動する場合があります。停止は `npm run preview -- stop`。PlaywrightはプログラムAPIを使う `scripts/preview-test.mjs` でテスト用サーバーを管理します。

依存は固定し、package-lock.jsonをコミットしています。配布版とNode要件はnpmの公式配布メタデータで確認しました。
- [Astroインストール要件](https://docs.astro.build/en/install-and-setup/)
- [Astro 7.3.2 配布情報](https://registry.npmjs.org/astro/7.3.2)
- [Node公式配布一覧](https://nodejs.org/dist/index.json)

## コンテンツの更新

- `src/site.config.ts`: ブランド、コピー、注目4件、カテゴリ、公開用接続先・招待URL。接続先は現在nullです。
- `src/data/content-registry.json`: 固定slugで管理。実装・配備・個々の検証・公開状態を分離しています。
- `src/data/pack-registry.json`: 選定済み14パック。canonical keyはmanifestのheader UUIDです。全パック数ではありません。
- `src/data/field-guide.json`: アイテム、レシピ、小さな機能のレコード。公開フィールドはsrc/lib/field-guide.mjsで選別します。
- `src/data/updates.json`: 人間が公開を確認したニュースのみ。現在は空です。
- `audit/source-evidence.json`: 確認対象commitと相対ソースパス。サイトのビルド出力には含めません。

`public/draft/private` はページ生成前の `src/lib/public-data.mjs` で分離し、さらにフィールドを明示的に選んでいます。検索はその公開済みカードだけを対象とします。draft候補は現状16件ありますが、固定件数を検証する仕様ではありません。非公開の実データをpublic/やクライアントスクリプトへ追加しないでください。

`scripts/refresh-audit.py` はリポジトリのmanifest/world登録を読み取り専用で照合し、このWebの初期棚卸しデータを再生成する開発補助です。実行すると編集済みのレジストリとニュースを初期内容で上書きするため、通常の更新やビルドには使いません。コードを読んだ人による再確認なしに、検証済みの根拠として扱わないでください。

## 素材・公開

public/images/直下のSVGは今回制作した独自の仮イラストで、実際のゲーム画面ではありません。参考モックやMinecraft公式素材のコピーではありません。OG画像は `node scripts/render-og.mjs` で独自SVGとHTML文字をブラウザ描画したものです。独自の木アイコン以外は画面上にも仮素材表示があります。外部フォント・外部画像リクエストはありません。

静的生成物はdist/です。baseは既存repo名の `/pinene-xserver-addons`、siteはURL生成用の想定値です。公開URLの稼働を確認したという意味ではありません。Pages/CI workflowは追加していません。本番公開には別途レビューが必要です。

画面と検証結果は [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) を参照してください。
