# ピネCD ネイティブ方式の適用試行と復旧（2026-09-14）

**結果：現行 BDS 1.26.45.1 へのネイティブ方式の適用は失敗し、今回の適用分を全対象で復元した。** GitHubのmainにも失敗したランタイムを残さず復旧する。修正案・曲カタログ・生成ツールは `fix/pinecd-native-records` ブランチで保存し、動作するリリースとは扱わない。

ユーザーの「全部適用して」により、GitHub Push、共有開発パック、開発用・最新ワールド、Xserverへの適用と必要なBeta APIs設定変更を実施した。既存のBSL・ゾンビ装備・ピネナイト更新を取り込み、GitHubへforce pushは行っていない。作業中に追加されたピネナイト更新 `56b2ab24` も維持した。

## 実行と検出

1. ローカルMinecraft `1.26.4501.0`、本番BDS `1.26.45.1` を確認。開発用はBeta APIs有効、最新ワールド・本番は無効だった。
2. 変更対象を事前ハッシュで固定し、ワールドセーブと変更前ファイルをバックアップ。全パックの上書きではなくCD関連ファイルと依存・登録の必要箇所だけ更新した。共有開発版は統合BP内の既存19アイテムを更新し、独立した音源RPを依存で接続した。
3. ローカル162ファイルに初回反映。変更対象外のセーブ・スクリプト13,102ファイルのハッシュを確認。
4. 橋渡しステージを開発用ワールドから作り直し、16 BP / 19 RP、`issues=0` を確認。本番は0人を確認して停止、40ファイルに初回反映。セーブ本体・建築・インベントリDBを更新対象にしていない。
5. 本番ロードで旧グループ名 `itemGroup.name.record` が拒否されたため、[公式の名前空間付きグループ](https://learn.microsoft.com/en-us/minecraft/creator/documents/craftingitemcatalogdocumentation?view=minecraft-bedrock-stable) `minecraft:itemGroup.name.record` へ修正し再配布。候補BPを1.0.29へ更新した。
6. 次の起動では19アイテム全ての独自音源名が `LevelSoundEvent` の列挙値として拒否された。アイテム読み込み失敗がCDタグを材料とする音素レシピにも波及した。

## 実機での切り分け

[公式1.26.30更新仕様](https://learn.microsoft.com/en-us/minecraft/creator/documents/update1.26.30?view=minecraft-bedrock-stable) はBeta APIsで独自音源名を使えると説明している。しかし、今回の実行ファイルではその条件でロードできなかった。公式記載だけをもとに「対応済み」とした前回の判断を訂正する。

本番とは別フォルダ・別ポート・別DBの検証用BDSを同じ1.26.45.1バイナリで起動した。プレイヤー参加を禁止し、最小の専用BP/RPと検証アイテムだけを使用。終了後、検証用プロセスは停止した。

- Beta APIsのみ有効：ドット区切り名 `pinecd.record.01`、コロン付き名 `pinecd:record.01` とも失敗。
- `use_beta_features: true` のトップレベル指定でも上記の受理エラーは変わらなかった。item/description内の指定は未知フィールドとして拒否された。
- 開発用ワールドの既存実験設定一式をコピーした隔離環境でも、format_version 1.26.0 / 1.26.30 / 1.26.40 と上記2種類の音源名は全て拒否された。
- 対照のバニラ `record.cat` は同じ最小環境でパースエラーが出なかった。
- 独自名を受理できる実行環境・バージョンは未確定。今回の結果から他のバージョンでの動作を推定しない。本番BDS自体のアップグレードは行っていない。

[Beta APIsのみの切り分け](evidence/pinecd-20260914/engine-probe.json)、[複数形式・実験設定の切り分け](evidence/pinecd-20260914/engine-probe-all-experiments.json)。

## 復旧結果

- **本番**：今回の39個のパック・登録ファイルを初回バックアップとバイト一致する状態へ戻した。level.datは現在のデータを維持し、`experiments` compoundだけを適用前の状態へ戻した。ワールドDBの巻き戻しは行っていない。17:43:16 JSTの `Server started.`、サービス `active`、今回起動のContent Logエラー0件を確認。
- **開発用 `8v9pvwiD6QQ=`・最新 `IC_Phase1_Fresh_20260911`・共有開発パック**：初回変更対象162ファイルをバックアップと一致する状態へ復元。今回追加した専用音源RPファイルも撤去した。両ワールドのDBは復元操作の対象外。変更していた最新ワールドのlevel.datも適用前へ戻した。使用中のMinecraftプロセスはなかった。
- **配布ステージ**：復旧後の開発用ワールドから再生成。失敗した配布データを残さない。
- **GitHub**：専用ブランチには候補と失敗の証拠を残し、mainのランタイム・登録情報は移行前の最新mainを維持する復旧コミットをPush。候補を本番へ再適用しない。

## バックアップ

- 初回ローカル：`C:/workspaces/pinecd-deploy-20260914/backup-local-20260914-172843/`。各ワールドのセーブZIPと162ファイルのrollback.json。
- 分類名修正前：`C:/workspaces/pinecd-deploy-20260914/backup-group-fix-20260914-173551/`。
- 初回本番：`/opt/minecraft/server/_pinene_deploy_backups/pinecd-native-20260914_173235/`。world-save-before.tar.gz、files、rollback.json。
- 本番の分類名修正前：`/opt/minecraft/server/_pinene_deploy_backups/pinecd-native-20260914_173631/`。
- 本番復旧前の失敗状態：`/opt/minecraft/server/_pinene_deploy_backups/pinecd-recovery-20260914_174308/`。
- ローカル復旧前の失敗状態：`C:/workspaces/pinecd-deploy-20260914/failed-local-native-20260914-174309/`。

## 検証の区別

静的検証（19曲、単一定義、既存曲・アイコン・入手経路の保全、依存、生成ツール6テスト）は成功した。**エンジンの独自レコード受理検証は失敗**。音楽ディスクの実聴、挿入・取り出し、ホッパー、比較器、多人数再生は未実施で、ネイティブ方式の適用完了とは報告できない。

[復旧結果](evidence/pinecd-20260914/recovery.json)、[復旧後の起動ログ](evidence/pinecd-20260914/recovered-startup.json)。
