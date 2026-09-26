# 拓也 Worker

PINE SERVER（ピネ鯖）向け案内AI「拓也」のAPIです。ピネWeb本体はGitHub Pagesの静的サイトのまま維持し、OpenAI APIキーはCloudflare WorkerのSecretにだけ保存します。

## 構成

- ブラウザ: `website/src/components/TakuyaChat.astro`
- 公開知識: `website/public/ai/knowledge.json`（Web build時に自動生成）
- API: このWorkerの `/chat`
- モデル: `gpt-6-luna`
- 回答上限: 600 output tokens
- レート制限: Cloudflare edgeで送信元IPごとに12回/60秒
- OpenAI Responses API: `store: false`
- 質問ログ: Cloudflare D1 `pine-takuya-logs`
- 保存期間: 最大30日
- 保存対象: 質問文・時刻・匿名会話ID・参照先・処理結果
- 非保存: IP・氏名・端末情報・元セッションID・AI回答本文

`knowledge.json` は既存の公開フィルタを再利用し、非公開・draftデータをAIへ渡しません。

## 初回セットアップ

OpenAI APIキーやCloudflare認証情報はGit・チャット・Webソースへ書かないでください。

```powershell
cd services/takuya-worker
npm.cmd install
npx.cmd wrangler login
npx.cmd wrangler secret put OPENAI_API_KEY
npm.cmd run db:migrate
npm.cmd test
npx.cmd wrangler deploy --dry-run
npm.cmd run deploy
```

`wrangler secret put OPENAI_API_KEY` の入力欄へ、OpenAI Platformで作成したAPIキーをローカル端末から直接入力します。

## 質問ログ

`TAKUYA_LOG_DB` はD1データベース `pine-takuya-logs` に接続します。新しい質問の保存時に30日より古い行を削除します。ログの読み取り用HTTP APIはWorkerに用意しません。

本人用の `website/admin/` がローカルPCのWranglerログインを使い、D1へ直接SELECTします。公開Web・GitHub Pages・ブラウザJavaScriptから質問ログを読む経路はありません。

## Web側を有効化

Workerの本番URLが確定したら `website/src/data/takuya-config.json` を更新します。

```json
{
  "enabled": true,
  "assistantName": "拓也",
  "apiUrl": "https://<worker-url>",
  "maxMessageLength": 1000,
  "historyTurns": 6
}
```

その後、Webを通常どおりvalidate/check/buildして公開します。API URLが未設定の状態では `enabled` を `true` にしないでください。

## 更新

`website/package.json` の `build` は `build:knowledge` を含みます。mainの公開コンテンツを更新してWebを再buildすると、拓也の知識も同時に更新されます。

## 確認

```powershell
cd services/takuya-worker
npm.cmd test
npx.cmd wrangler deploy --dry-run

cd ../../website
npm.cmd run check
npm.cmd run build
```

`GET /health` はOpenAI APIキーを使用せずにWorkerの生存確認へ使えます。
