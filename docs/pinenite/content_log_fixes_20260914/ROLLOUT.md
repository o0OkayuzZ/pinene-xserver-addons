# Content Log 修正の反映結果

実装コミットは `ac5551f5`、混在 geometry の補正を含む最終実装は `cb3cda0f`。どちらも GitHub main に反映済み。2026-09-14 22:17 JST までにローカル・XServer 本番への反映が完了した。

| 配布先 | 最終ファイル照合 | 最終更新時のセーブ保持 | 結果 |
|---|---:|---:|---|
| XServer 本番 | 142 ファイル | 449 ファイル | 成功・サービス active・再起動確認済み |
| 開発ワールド `8v9pvwiD6QQ=` | 142 ファイル | 13,052 ファイル | 成功 |
| `IC_Phase1_Fresh_20260911` | 142 ファイル | 8 ファイル | 成功 |
| 共有インストール済みパック・開発元の対象ファイル | 95 ファイル | ワールド DB 更新なし | 成功 |

初回修正は各ワールド 126 ファイル、最終補正は同じ対象内の 4 ファイルを更新した。表の照合数には変更しなかった元の Pinenite モデル・テクスチャも含む。各段階で完全ワールドバックアップと変更前ファイルを保存し、更新中にセーブ関連ファイルのハッシュが変わっていないことを確認した。再起動を挟んだ段階間での DB ファイル数変化は、この同一性検査とは区別する。

最終版は Outline RP **1.0.2**、統合 Death BP **2.12.22**。Zombie Gear BP / RP は変更ゼロ。Pine main と共有 Death ペアは既存の依存先を壊さないようヘッダーバージョンを維持し、配布ハッシュで修正の到達を確認した。

最終再起動のサーバー Content Log は空で、起動ログにも error / exception はない。これはクライアントの material・geometry 描画の実機検証ではない。修正版でクライアントを起動した後の描画確認と新しい Content Log の確認が必要。

- [変更ファイル全一覧・SHA-256](changed_files.json)
- [全配布先の最終照合](final_verification.json)
- [テスト結果](tests.json)
- [サーバー最終反映](server-final-result.json) / [起動ログ](server-final-startup.log) / [Content Log](server-final-content.json)
- [開発ワールド最終反映](development-final-result.json) / [もう一方のワールド](latest-final-result.json)
- [共有・開発パック初回反映](installed-result.json) / [最終補正](installed-final-result.json)

各 result.json の `backup` が復元用保存先。未解決の音源欠落、Lighting 警告、既存 block 警告、および防御値の実機測定については [修正報告](../CONTENT_LOG_FIXES_20260914.md) を参照。
