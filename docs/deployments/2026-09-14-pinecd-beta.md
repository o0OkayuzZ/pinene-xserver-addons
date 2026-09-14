# ピネCD beta形式への修正・適用記録（2026-09-14）

数値format_versionでは独自sound_eventが列挙値として拒否された原因を、隔離したBDS 1.26.45.1で再検証した。format_versionをbetaにし、Beta APIsを有効にすると19枚すべてが登録された。use_beta_featuresやBP側音定義は不要だった。

## 実施した検証

- 数値形式とbeta形式、独自イベントのドット／コロン表記、バニラrecord.cat、Beta APIs有効／無効を比較。
- 実際の16BP・19RPに検証専用BPを足した隔離環境で、ItemTypesから19枚を確認。missing=[]。
- 移行前の構成も同じ隔離条件で起動し、Content Logのエラー内容を比較。双方8件で差分ゼロ。既存のオンソ材料タグ関連6件と青リンゴレシピunlock関連2件。レシピ本体は変更していない。
- 生成ツール6テスト、全19音源のVorbisストリーム確認、CD09復号PCM一致、残り18音源・19アイコン保持、重複と依存関係、git diff --check。
- [機械可読の比較結果](evidence/pinecd-beta-20260914/comparison.json)と同ディレクトリのエンジンログを保存。

隔離検証は別ポート・別ワールドで実施。診断用スクリプトは登録確認だけを行い、音を再生しない。配布パックには含めない。

## 未実施の検証

実クライアントの試聴、取り出し・破壊停止、曲末、比較器・ホッパー、複数再生・複数プレイヤー、距離減衰、再接続、バニラ・他パック音の聴覚確認。読み込み成功を試聴済みとは扱わない。

## 適用

適用先のバックアップと反映結果は完了後に追記する。作業ブランチはfix/pinecd-native-beta。旧失敗記録は履歴として保持する。

## 最終結果

- 共有開発パック、開発用ワールド8v9pvwiD6QQ=、IC_Phase1_Fresh_20260911、配置用stage、Xserverへ反映済み。19枚のCDと独自イベント、依存・登録の整合性を確認。専用BP/RPは1.0.30。
- ローカル162操作。対象外セーブ・スクリプト等13,102ファイルの保持を確認。バックアップ：C:/workspaces/pinecd-deploy-20260914/backup-local-20260914-181150。
- stageは16BP/19RP、issues=0。既存の未登録フォルダはstageから除外する既存運用を維持。
- Xserverは接続者0人を確認して停止、ワールドをバックアップ後に40操作を反映。既存DBを巻き戻さず、必要なBeta APIsの実験フラグだけを追加。対象外セーブ456ファイルの保持を確認。
- サーバーバックアップ：/opt/minecraft/server/_pinene_deploy_backups/pinecd-native-20260914_181410。2026-09-14 18:15:26 JSTにServer started、service=active。配置35ファイル・登録・Beta APIsが一致。今回取得した起動Content Logはエラー0件。
- 別ワールドでは元構成にも候補にも既存レシピエラー8件が再現した。既存ワールドの起動ログ0件という結果と、新規DBによる全パック再検証8件という結果は区別する。
- 隔離ワールドで19枚＋バニラcatをネイティブジュークボックスに挿入し、getRecordのID、isPlaying=true、取り出し後isPlaying=false・空状態を全20件確認。[結果](evidence/pinecd-beta-20260914/engine-probe-jukebox.json)。クライアント音声は未取得であり、実際の試聴済みとはしない。

診断用[jukebox_check.js](../../tools/pinecd/jukebox_check.js)は使い捨ての隔離ワールド専用で、配布BPには含めない。公式[BlockRecordPlayerComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/blockrecordplayercomponent?view=minecraft-bedrock-stable)でネイティブ状態を検査する。再現する場合はコピーした検証ワールドの一時Script BP（@minecraft/server 2.9.0依存）に入れる。座標0,100,0のブロックを変更するため、実ワールドでは実行しない。

反映・検証の詳細JSONは同じevidenceディレクトリに保存。旧候補ブランチは履歴として保持し、今回の実装はfix/pinecd-native-betaにまとめた。
