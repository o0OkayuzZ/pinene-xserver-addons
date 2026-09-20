# NF100種・金食料図鑑グリント・独立影パックの反映

2026-09-20。NF実装 `e84adb6ebb92eac345ef85f53d0297023a35bc95`、Web図鑑 `265761b8` を反映。

## NFと図鑑

- Xserver `Bedrock level`、開発用 `8v9pvwiD6QQ=`、`IC_Phase1_Fresh_20260911` に216ファイルずつ適用し、全ファイルをハッシュ照合。
- 適用前に各ワールド全体と変更対象をバックアップ。NF適用中にセーブファイルが変わっていないことを確認（Xserver523、開発用13052、Fresh8ファイル）。
- BP15 1.0.72、RP2 1.0.61、金食料図鑑を持つBP2 1.0.35。依存版も更新。登録順・独立影パックの登録は保持。
- Mycology61テスト・金食糧45テスト。100種の正式マスター、PNG、atlas、名称、取得カテゴリ、図鑑登録を検証。
- WebはNF詳細100ページと正式画像100枚を追加。1108ページを生成。公開先は `https://o0okayuzz.github.io/pine-server/`。旧公開先のリダイレクトは変更していない。
- 公開サイトの100詳細ページの名称と、100枚のPNGのSHA-256を照合。390/768/1440pxのローカルブラウザテスト合格、公開サイト390/1440pxも確認。
- GitHubの `o0OkayuzZ/pinene-xserver-addons` mainへソースをpush。生成物は別リポジトリ `o0OkayuzZ/pine-server` のgh-pagesへpush。

## 影パック独立化の追従

ユーザー確認により「統合パック分割」は影パックの独立管理を指す。
正本は共有開発RPの `Pinene_Visuals_RP`、別GitHubリポジトリ `o0OkayuzZ/vibrant-visuals` のmain `40fbdd4`。ローカルHEADとorigin/mainが一致し、未コミット差分なし。

- 開発用ワールドは既に1.3.32。実行用1571ファイルが正本と一致していたため変更なし。
- FreshとXserverは1.3.22だったため1.3.32へ更新。正本から除去済みの旧描画7ファイルはバックアップ後に削除。
- Pinenite Outline 1.0.6、Grave RP 1.0.9、PineCD RP 1.0.31のPBR capability修正と依存BPの版を追従。
- Fresh103操作、Xserver138操作。最終的に3環境の影パック実行用1571ファイルが正本と完全一致し、各ワールドの有効なパック登録版も一致。
- 実行環境のフォルダー名 `rp_10_...` は維持。統合アドオンのGitHubへ影パック本体を再収録せず、独立リポジトリを正本として反映した。
- `.git` やREADME等の管理用ファイルは実行用素材照合・配布から除外。

## 起動時に判明した通信設定

再起動したサーバー本体1.26.51.1が `transport=nethernet` を要求。NFのContent Logは空だったが、通信方式エラーを検出した。サーバー本体・バイナリは今回変更していない。

同梱 `bedrock_server_how_to.html` と[公式26.50更新情報](https://feedback.minecraft.net/hc/en-us/articles/48826825649933-Minecraft-Bedrock-Edition-26-50-Changelog-Wilderness-Bound)を確認し、設定をバックアップして `transport=nethernet` を追加。既存のUDP19132へ固定するため `server-udp-ports=19132` も追加。最終再起動でサービスactive、Server started、起動エラー0件を確認。

初回の外部TCP19132接続テストは不成功。ユーザー提供の管理画面でUDP19132のみ許可されていることを確認し、ユーザーがTCP19132の許可を追加した。その後、外部TCP接続と `GET /v1/join` のHTTP 200応答を確認（Bedrock 1.26.51、Bedrock level）。サービスactive、起動ログのエラー0件。通信開始部分の疎通は復旧。実クライアントでの入場・影の見え方・NFの操作は未検証。

## バックアップと証跡

- ローカル：`C:/work/nf-release/backup-local-dev`、`backup-local-fresh`、`backup-visual-fresh`。
- Xserver：`/opt/minecraft/server/_pinene_deploy_backups/nf-20260920`、`nf-visuals-20260920`。
- 配布結果は [evidence/nf-20260920](evidence/nf-20260920)、公開サイト照合は `website/artifacts/nf-live.json`。
- 今回の作業ディレクトリはリポジトリを置く入れ物で、対象の共有開発BP/RPは存在しなかった。ゲームで使用中のローカル2ワールド内パックを更新した。独立影パックの共有開発コピーは既に最新で変更なし。
