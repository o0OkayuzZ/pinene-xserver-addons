# Pinenite 全環境適用 — 2026-09-14

ユーザー指定のローカル・GitHub main・XServer本番を対象に、Pinenite FINALの変更を配備した。
ゲーム配備元コミット: `d1536bced6d01ad522f339ce12915fbb2cc3c337`。
実装時点のmain `08b41ef`から、最新main `196d0921f74dabf52f5692d5cb5251c1a733c13d`へ競合なくrebaseしてから配備した。

## 反映先

| 対象 | 更新パックファイル | 照合ファイル | 保持したセーブ関連ファイル |
|---|---:|---:|---:|
| server | 23 | 35 | 458 |
| development | 23 | 35 | 13059 |
| latest | 23 | 35 | 8 |

- server: `/opt/minecraft/server`、使用ワールド`Bedrock level`
- development: 開発用ワールド`8v9pvwiD6QQ=`
- latest: 最新ワールド`IC_Phase1_Fresh_20260911`
- ローカルの既存Deathnerite BP/RP: 38ファイルを反映・ハッシュ照合。未導入だったPineniteの元モデル・PNG・アトラス項目・日本語/英語名・入手functionも追加した。

ローカル共通パックは`Shared/games/com.mojang/behavior_packs/[NEW]DeathBP`と`resource_packs/[NEW]Death`。
これらは元から使用するRP UUIDが本番の統合RPと異なるため、元UUIDと依存を維持した部位限定の適用。
既存の外観確認用Pinenite単独パック、バックアップ、過去の実験ワールドには変更を加えていない。

## バージョンと変更範囲

- 本番・両ワールド・GitHub: Deathnerite BP **2.12.19**、Pineniteを収録する統合Dungeons RP **2.0.7**。
- 依存先RPの更新に必要なDungeons BP manifestも **2.0.7**。Dungeonsのゲーム内容は変更していない。
- 古いローカル単独Deathnerite BP/RP: **2.12.13**。その既存の構成・UUIDを保ち、Pineniteだけを追加した。
- Zombie Gearのファイル、全Mob/player定義、既存のモデル・PNGには変更なし。
- 各環境の登録情報はその環境の現状を読み、上記3 UUIDのバージョンだけ更新した。

XServerでは無限城のルート登録が0.2.6、実際のワールド登録とmanifestが0.2.7だった。
最初の事前検証がこれを検出し、停止・書込み前に中断した。
その後、サーバーの実際のワールド登録を使って依存関係を検証した。現地の無限城0.2.7とその他の更新を保持し、起動ログでも0.2.7を確認した。
これはPineniteの対象外なので、古いルート側の無限城登録を変更する修復は含めていない。

## バックアップ・起動・検証

各ワールド全体と変更前ファイルをバックアップし、配備後に対象ファイルをSHA-256で照合した。
セーブDB・建築・所持品・攻略状態をGitのデータで上書きしていない。
ローカルはMinecraftが停止していることを確認し、XServerはオンライン0人を確認して正常停止・適用・再起動した。

- XServer: **active**、17:22 JSTに`Server started.`を確認。
- 起動ログのエラー: **0件**。新規Content Log **1件、空**。
- 最新main統合後: **140テスト成功**（Pinenite39件、既存101件）。
- Pinenite資産検証: **154項目成功**。今回のGit版の登録不整合警告は0件。
- パック読み込みとサーバー起動の確認は、戦闘・装備描画のクライアント実機確認を代替しない。

防御41のエンジン上限、armor/Resistanceより前の元ダメージ取得、跳躍距離、Molang発光の実描画は引き続き実機確認が必要。
Pinenite独自適応前のダメージ保持・反射再帰防止は自動テストで検証済み。
入手: `/function pinenite/give_set`。観測: `/scriptevent true_dn:pinenite_probe label`、終了: 同コマンドの`off`。

## 証跡

[配備結果・バックアップ先](deployment_20260914/result.json)、[本番起動ログ](deployment_20260914/startup.log)、[Content Log](deployment_20260914/content.json)、[テスト全文](deployment_20260914/tests.log)。
各対象の変更ファイル・変更前後ハッシュ・登録情報は同ディレクトリの`*-files.json`に保存した。
能力別の実装と実機確認手順は[実装報告](COMBAT_REPORT.md)を参照。
