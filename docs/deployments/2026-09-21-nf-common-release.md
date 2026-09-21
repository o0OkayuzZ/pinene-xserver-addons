# NF共通基盤・摂食クールタイム解除の反映 / 2026-09-21

開発ワールド、検証用ワールド、Xserver、本体GitHub、公開Webへ反映済み。実行用ソースは `c348d0d91a0c87deabc2b9d471eab722e01f5be6`。個体別の未承認性能は有効化していない。

## 反映内容

- 食用キノコ32種の4秒クールタイムを解除。食事動作1.6秒と既存効果を保持。
- NF共通状態管理の基盤を追加。正式PNG・ID・表示名・図鑑・鑑定を維持。NF-021〜100は個体性能の確定待ち。
- mainに取り込まれた既存のパック整理も反映。Crossbowのリソース所有先をRP07へ統合したため、有効パック数は36から35（BP16/RP19）へ。退役231ファイルは承認済みの旧Git内容との一致を確認してからバックアップし、稼働パックから除去。
- PineCD BPとGapple Cows BPに残っていた旧RPバージョンへの依存を修正。同版で内容差分があるパックと依存元の版番号を上げ、登録JSONを整合。
- 統合BPは1.0.75、統合RPは1.0.62、Zombie Gear BPは1.2.7、RP07は1.2.8。
- 独立した影パック1.3.32を先頭に置く既存順序とPvP RPのPBR宣言を保持。

## 確認結果

- 3環境それぞれで対象13,892ファイル、35パックの順序・版番号・依存関係を照合し、不一致0件。退役231ファイルは稼働パックに残っていない。
- 開発ワールド354ファイル、検証ワールド355ファイル、Xserver357ファイルを更新（退役ファイルの除去を含む）。
- 更新前後のセーブ内容は不変: 開発13,054ファイル、検証8ファイル、サーバー530ファイル。DBやワールドの置換は行っていない。
- サーバーは無人を確認して更新・再起動。サービスactive、起動確認済み、起動ログのerror/exceptionなし。外部 `19132/v1/join` 応答正常（Bedrock1.26.51、protocol2193）。
- 全体テスト321件合格。Mycologyの公式型チェックと静的整合検査、pack ownership監査も合格。
- 準備時に失敗した古いPinenite検査は、所有先統合済みの承認基準 `294914f3` と比較する形へ更新。PineCDは固定版番号ではなく現行manifest/module/dependencyの一致を検査する。対象を除外して握りつぶす変更ではない。
- Web: 1,108ページのビルド、公開内容テスト4件、出力監査合格。Pagesコミット `4d55f048a1b189fea93659b3351d4bf4fb2ee006` の公開完了、新着と版番号のHTTP200/本文一致を確認。
- Bedrockクライアントでの連続摂食は利用者による確認待ち。

証跡: [evidence/nf-common-20260921](evidence/nf-common-20260921)。

## バックアップと適用時の保護

- ローカル: `C:/work/nf-release/nf-common-20260921/backup-dev`、`backup-fresh`。
- サーバー: `/opt/minecraft/server/_pinene_deploy_backups/nf-common-20260921`。
- 各ファイルの更新前SHAを確認し、バックアップ後に差分適用。最初のサーバー試行はWindows/Linux間のパス区切り差を事前検査が検出して停止し、サーバーを変更する前に修正した。修正後の再適用は成功。

## 別管理の無限城ミラー

本体GitHubは更新済みだが、別リポジトリ `pinene-infinite-castle` の自動同期は認証設定不足で保留。ソース側のエクスポーター検査は合格したが、[実行35612732321](https://github.com/o0OkayuzZ/pinene-xserver-addons/actions/runs/35612732321)で `INFINITE_CASTLE_MIRROR_APP_CLIENT_ID` / `INFINITE_CASTLE_MIRROR_APP_PRIVATE_KEY` または `INFINITE_CASTLE_MIRROR_TOKEN` が未設定と判明した。生成先への手編集や、既存の広い権限を持つ認証情報の転用は行っていない。

設定手順は [運用資料](../operations/infinite-castle-mirror.md) を参照。これは本体GitHub、ローカル、Xserver、公開Webの反映を妨げないが、ミラーの自動公開成功とは報告しない。
