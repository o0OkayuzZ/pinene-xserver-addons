# XserverのPvP RPに欠けていたPBR対応宣言

影の優先順位を開発ワールドに揃えても改善せず、ユーザーが「影と水面反射が出ない」「Xserverでは鮮やかなビジュアルを選択できない」と確認した。

PvP Island RP 0.2.22のローカル開発ワールド・ソースには`capabilities: ["pbr"]`があり、Xserverの同版manifestにはなかった。以前記録したmanifest差分を調査対象から外したのは誤り。ファイル名やバージョンだけでなく、描画モードの対応宣言まで照合する必要がある。

サーバーのRPへ宣言を追加し、RP・依存BPを0.2.23へ更新。Xserver、開発ワールド、ソースのmanifestとワールド登録を更新した。描画素材・ゲームプレイスクリプトは変更していない。

全20RPのcapabilities、min_engine_version、versionが開発ワールドとXserverで一致することを検証。全20RPの順序付き登録も完全一致。バックアップはXserver`_pinene_deploy_backups/pvp-pbr-20260920-213440`、ローカル`C:/work/nf-release/pvp-pbr-dev-backup`。

ユーザーのMinecraft終了とサーバー接続者0人を確認して適用。実機で鮮やかなビジュアルを再選択できるか、影・反射が復帰したかはユーザー確認待ち。

対応宣言の仕様: https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/vvresourcepacks?view=minecraft-bedrock-stable
