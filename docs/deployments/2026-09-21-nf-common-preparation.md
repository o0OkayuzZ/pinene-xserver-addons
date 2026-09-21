# NF共通基盤・摂食クールタイム解除（反映準備）

これは準備時点の記録。反映後の結果は [2026-09-21-nf-common-release.md](2026-09-21-nf-common-release.md) を参照。

状態: ソース作成・検証済み。開発ワールド、Xserver、公開Webへは未反映。

基準コミット: `294914f3`。ユーザー提供の共通仕様原本は `tools/mycology/docs/NF_COMMON_SPEC_V1.md`、実装範囲・保留事項は `tools/mycology/docs/NF_COMMON_IMPLEMENTATION.md`。

## 内容

- 32種の食用キノコから4秒クールタイムを除去。1.6秒の食事動作と既存効果を維持。
- NF Registry/State Manager、activeのみの共通Scheduler、牛乳/死亡解除、オンライン時間保存、致死抽選、Stack/Gauge/Phase、イベント接続、Interaction Registryを追加。
- NFの個体別性能は未承認のため有効化しない。正式なID・名称・完成PNG・ガチャ・図鑑は維持。
- BP15: 1.0.73 → 1.0.74。依存閉包によりZombie Gear BP: 1.2.5 → 1.2.6、RP07: 1.2.6 → 1.2.7。UUIDとパック順序を維持。

## 検証

- Mycology 80テスト合格（致死10秒前の牛乳、再抽選防止、再摂食での時計維持、復元、症状抑制、101以降、Scheduler1本を含む）。
- Mycology静的チェックと公式 `@minecraft/server 2.7.0` 型チェック合格。`tools/mycology/data/validation.json` と `docs/TEST_OUTPUT.txt` に結果。
- 全体 `npm test` はPineniteの3件で停止。Golden Foods 45件、墓8件、GF4件、Pineniteの66件は合格。Castle段階には到達していない。
- 全体の失敗3件は今回変更しない既存ファイル・履歴に起因する: `tests/pinenite/assets.test.mjs:54` の過去コミットからentity無変更という条件、`outline.test.mjs:33` のPineCD RP 1.0.31固定（mainは1.0.32）、`outline.test.mjs:88` のRP07内容無変更条件（mainにCrossbow統合済み）。今回のNF差分に該当entity、PineCD、RP07のlang変更はない。検査条件を書き換えて合格扱いにはしていない。
- Bedrockでの実食・感染・死亡などの動作確認は未実施。

## 反映前に残ること

- 個体別の正式性能表を受領後、確定値だけを追加する。
- Minecraftプロセスが起動しているため、開発ワールドのパックは書き換えていない。終了待ち。
- Xserverは確認時0人だったが、反映時に再確認する。今回サーバーの停止・書換えは行っていない。
- 直近mainには別途パック整理が入っているため、古い2026-09-20全体反映計画をそのまま再実行しない。現行ランタイムとの差分を取り直し、影のPBR設定と有効パック順序を保持して反映する。
