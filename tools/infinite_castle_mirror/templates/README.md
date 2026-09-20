# Infinite Castle — AUTO-SYNCED MIRROR / DIRECT EDIT禁止

このrepoは [pinene-xserver-addons/main](https://github.com/o0OkayuzZ/pinene-xserver-addons/tree/main) から自動同期される閲覧・配布用ミラーです。
**開発上の唯一の正本は `pinene-xserver-addons/main` です。ここで直接編集・機能開発しないでください。**

- 実装変更・不具合修正・このREADMEの変更は正本へ行ってください。
- `behavior_packs/infinite_castle` / `resource_packs/infinite_castle` は正本のmanifest UUIDから特定したパックの完全コピーです。削除も反映されます。
- [SOURCE_COMMIT.json](SOURCE_COMMIT.json) に正本repo・branch・commit SHA・同期日時・対象パス・SHA-256一覧を記録します。
- 古い場合は [正本の同期Actions](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/workflows/sync-infinite-castle.yml) と認証設定を確認し、`workflow_dispatch` で再同期してください。手作業で修正しません。
- [導入記録](.mirror/docs/infinite-castle.md) / [同期運用手順](.mirror/docs/operations.md)。導入記録内の正本相対パスは正本repoで参照してください。

## 配布範囲と履歴資料

これはサーバー構成からの抜粋です。無限城は他のサーバーパックの `dungeons:*` エンティティやBSL報酬等を使用します。この2パックだけで独立動作することは保証しません。完全な依存関係・開発ツール・デプロイ手順は正本を参照してください。

`archive/initial-snapshot/` はミラー移行前の全ファイルを元の相対パスと内容で保存した歴史資料です。旧README、設計意図、テスト、`development`、`snapshot-files.json` を含みます。旧コードは現行実装ではなく、開発場所として使用しません。
`development/` とルートの `snapshot-files.json` も互換性のため保持していますが、**旧スナップショット専用**です。現行配布物のハッシュ一覧は `SOURCE_COMMIT.json` を使用してください。

同期は管理対象のパック、`.mirror/`、このREADME、AGENTS、整合性CIとメタデータだけを更新します。履歴資料や同期対象外のドキュメントは削除しません。
