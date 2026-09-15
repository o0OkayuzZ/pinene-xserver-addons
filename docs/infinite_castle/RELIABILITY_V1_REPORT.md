# Infinite Castle Reliability Fix v1.0

## 状態

最新main取得時の `d033ab99695c30c71fbcdbe4cdf0370923ad31b6` を基点に、`fix/infinite-castle-reliability-v1` で実装。
作業コピー: `C:/work/pinene-ic-reliability`。

全体反映の指示に従い、開発用・Freshテスト・共有パックと本番へ配備。Aurealisには共有パック経由で反映します。詳細は[全体反映記録](GLOBAL_ROLLOUT_20260915.md)を参照。クライアントの振り動作と2〜4人での復旧確認は未実施です。

## 実装

1. **復旧処理**: 状態をCOMPLETE / PREPARING / REBUILDING / VERIFYING / COMMITTING / RECOVERY_REQUIRED / RECOVERINGへ統一。旧名は読み込み時に変換。失敗時は復旧要求を保存し、同じ所有者の処理内で復旧を試行。再失敗は次回も復旧可能な状態を保持。
2. **永続記録**: 旧planのdescriptor・部屋素材／役割・遭遇状態を新planの書き込み前に記録。COMMITTINGでdescriptorが切り替わった後も旧planへ戻せる。reconstruction stateにもdescriptorを保存し、入口runtimeがなくても復旧可能。
3. **安全な再配置**: 残存候補を消去し、旧planを再配置・形状検証。在室区画と元の再構築で保持した保護対象を保持し、各書き込みは移動中のプレイヤーとの重なりを再確認。非initial時に入口役割を新規割当しない既存処理を維持。
4. **復旧の確定順序**: `saveDetailedPlan(oldPlan)` → COMPLETE → source runtime再有効化 → 遭遇状態復元と `activateRoomEncounterPlan(oldPlan)` → 復旧記録の解除。再構築開始時は検知処理だけ一時停止し、永続runtimeを残す。
5. **ready watchdog**: 60tick後に「§e無限城を復旧中です…」。400tick後、別の処理が実行中でなければmanagerへ復旧要求。watchdog自身は城を書き換えない。
6. **出口表示**: 近距離のプレイヤーがいる出口で、decoratedに関係なく5×5床を検査。再構築中は書き込まず、不一致タイルだけ修復。
7. **報酬保護**: 未stockedのowned chest周辺3×3×3の設置をキャンセル。interaction側も設置先とminecart利用を保護。既存の搬送ブロックやhopper minecartがある場所での設置・配布は停止。27枠・配布記録・占有slotを検査し、異常時は未知アイテムを保持して構造化ログを残す。
8. **V4再開**: pending対象slotが空なら同slotを再試行、非emptyならcursorを進める。配布済みslotへ重複生成しない。V3部分配布は引き続きV3テーブルで完了させる。
9. **run・戦闘履歴**: 攻略中のオンライン参加者がdimension内にいない状態が60秒続けばrunを終了。期限内復帰は同run。終了済みrunへの復帰者は安全な帰還を経て既存の新run入場処理へ進む。死亡済みslotは保存し、生存slotだけsuspendedから再開。
10. **spawn watchdog**: 敵0・pending0・未完了が60tick続けば一度だけqueueを復元。spawn例外はslotごとに3回でfailedへ移し、再修復後も異常ならその部屋をErrorに隔離。再入室・再起動で修復回数をリセットしない。
11. **ticking-area診断**: preflight / create-load / callbackの失敗について、area名・bounds・chunk数／上限・状態・旧新seed・人数を1つのログに記録。native promiseの拒否やtimeoutを成功扱いにしない。

## BSL監査と維持事項

[全94テーブルの監査結果](reliability-bsl-audit.md)と[JSON明細](reliability-bsl-audit.json)を記録。
変更は `pots/trial_chambers/corridor.json` のHeavy Coreエントリー削除のみ。他の93テーブルは改行形式を除き元の内容と一致し、該当壺テーブルも他エントリーは完全一致。

当初のmain向け修正はV4と5〜15分周期を維持しました。全体反映では、既に開発環境・本番へ導入されていたV5のスロット数（通常17〜21・Elite20〜24・宝物庫24〜27）、3〜5分周期、装飾30〜60秒を取り込み、既存設定の巻き戻しを防いでいます。V4の配布途中の記録はV4の範囲を保持します。15室構成・戦闘設定・出口のしゃがみ条件は維持しています。

## 自動テスト

**272件通過、失敗0件**。`npm test` に無限城110件とPinenite61件を含みます。変更JavaScript 35ファイルの構文検査、変更JSONの解析、差分検査も実施。[機械可読の検証結果](reliability-test-results.json)。

## クリエイティブ録画用の全体再構成

パッチ適用後、無限城内でクリエイティブのプレイヤーが実行します。

```mcfunction
/scriptevent infinite_castle:rebuild_record start
```

攻略棟と装飾棟をまとめて再構成します。全体再構成なので入口を含む構成と攻略状態も更新されます。クリエイティブのまま飛行して撮影できます。城内の全員がクリエイティブまたはスペクテイターである必要があります。処理中にサバイバル／アドベンチャーのプレイヤーが入ると停止します。他の再構成処理中は実行できません。前回の復旧が必要な場合は先に復旧し、完了後に再実行するよう案内します。

既存の `/scriptevent infinite_castle:rebuild_all` はスペクテイター専用です。録画用の許可、途中のモード変更、コマンド経路、遭遇状態の退避・復元について7件のテストを追加しました。実機での録画確認は未実施です。

`npm test` に `test:castle` を追加し、従来のMycology / Golden Foods / Pineniteに加えて無限城の全Nodeテストも実行。

追加・更新した故障注入／回帰テスト:

| 検証 | 自動テスト |
| --- | --- |
| 正常な部分再構築とruntime再有効化 | reliabilityRecovery |
| 25%・50%地点の例外、structure.place例外、ticking-area作成例外 | reliabilityRecovery |
| PREPARING / REBUILDING / VERIFYING / COMMITTING / RECOVERINGの再起動 | reliabilityRecovery |
| descriptor切替後・runtime有効化時の例外 | reliabilityRecovery |
| 入口runtime欠落、descriptor欠落、復旧中の再例外 | reliabilityRecovery |
| 2〜4人が異なる部屋に在室した状態での失敗 | reliabilityRecovery |
| 復旧が入口・人数・run判定より先に実行される | reconstructionClock |
| 旧新plan＋部屋役割の永続propertyサイズ | reliabilityRecovery |
| 出口床1マス／25マス削除、再構築中の修復抑止 | reliabilityRuntime |
| 未配布chest横へのchest / hopper / dropper / dispenser / rail設置 | reliabilityRuntime |
| pending slot空／占有時の再起動、書込直後例外、重複防止 | phase1RewardsV4 |
| A切断＋B退出後60秒で終了、期限内復帰、新run参加経路 | reliabilityRuntime |
| 雑魚を倒して退出→再入室、さらにスクリプト再読み込み | reliabilityRuntime |
| spawn強制失敗→一度だけ修復→部屋隔離 | reliabilityRuntime |
| readyの3秒表示・20秒要求・busy時要求抑止 | reliabilityRuntime |
| Heavy Core削除と残す進行アイテムの監査網羅性 | reliabilityLoot |

故障注入テストは実際の再構築所有者・状態遷移・block/area呼び出し経路を使用し、MinecraftネイティブAPIと高コストの素材配置／形状検証はモック化しています。専用の既存テストでplanner・socket・素材割当も検証しています。これらは実機のチャンク挙動や複数人通信を証明するものではありません。

補助のDungeons報酬テストでは、main時点の36パックを旧35個固定の期待値と比較して失敗していたため、manifestのUUID一意性とworld登録集合の完全一致を確認する形へ更新しました。パック構成自体の変更はありません。

## 実機確認の残作業

1. 複製したテストワールドに、この差分のCastle scriptsとBSL壺テーブルを適用する。
2. Content Logを有効にして入場し、敵・宝箱・特殊部屋・出口が通常どおり動作することを確認する。
3. 2〜4人で異なる階・部屋を探索し、再構築／復旧中の在室区画、通路、落下・窒息の有無を確認する。
4. 故障時の `[ic-loaded-bounds-error]` / `[ic-recovery-required]` と復旧後COMPLETE、source runtime、Phase1の動作を確認する。
5. 退出・再接続、報酬のslot数、出口床修復、未配布chest周辺の設置防止を実機で確認する。

API参照: [PlayerPlaceBlockBeforeEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerplaceblockbeforeevent?view=minecraft-bedrock-experimental)。このイベントがないエンジンでも既存のinteraction before-eventで設置・minecart利用を保護します。
