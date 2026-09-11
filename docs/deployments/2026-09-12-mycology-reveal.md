# 2026-09-12 Mycology 鑑定演出の配備

実装コミット `cfc0fa3d4218c8f3188f23dc95817e6b86b72200` をGitHub main、ローカル2ワールド、Xserverへ反映した。

64連は15〜25秒（20 TPS時）。溜め・連続開封・最高レア発表と、35種それぞれの音色／メロディを実装。回復系、毒系、強化系、神秘系、胞子系で音を分け、★9・★10には専用の締めを用意した。しゃがみでスキップ、鑑定メニューで短縮・OFFと消音を切り替えられる。

| 対象 | 更新・ハッシュ一致 | セーブ関連ファイルの更新前後一致 |
|---|---:|---:|
| 開発用ワールド `8v9pvwiD6QQ=` | 4 / 4 | DB・ルート42ファイル |
| 最新ワールド `IC_Phase1_Fresh_20260911` | 4 / 4 | DB・ルート10ファイル |
| Xserver `Bedrock level` | 4 / 4 | ワールド内408ファイル |

更新は統合BPのMycology `ui.js`、`rarity_ui.js`、`reveal.js`、`reveal_sounds.js` のみ。鑑定処理と依存モジュールの一致を確認し、BSL・無限城（0.2.3）・他のパックと登録を保持した。GitHub内のcanonical/runtimeコピーもバイト一致。スクリプトだけの配備でmanifestの版は変更していない。

ローカルはMinecraft終了中に配備。既存ファイルをバックアップし、途中失敗時の復元処理を用意した。Xserverはオンライン0人を確認して正常停止後、ワールド全体をバックアップして更新。**03:37:42 JSTに `Server started.`、サービス `active`、起動ログのエラー0件**を確認した。その後の再確認でもエラー0件。今回の監視先には新規Content Logファイルは生成されていなかった。

- ローカルバックアップ: `%USERPROFILE%/.codex/tmp/mycology-reveal-20260912/backups/`。
- Xserverバックアップ: `/opt/minecraft/server/_pinene_deploy_backups/mycology-reveal-20260912_033523/`。`world-before.tar.gz`、変更前ファイル、配備計画・結果を保存。
- 自動テスト57件・型チェック成功。抽選重み（赤2899・茶3183）、同期鑑定・復旧処理は変更なし。
- 実機での聴感・描画・操作テストは未実施。音量バランスや他アドオンのHUDとの重なりは実機確認が必要。

[仕様と検証](../mycology/GACHA_REVEAL_2026-09-12.md)、[配備結果・ファイルハッシュ](evidence/2026-09-12-mycology-reveal/result.json)。
