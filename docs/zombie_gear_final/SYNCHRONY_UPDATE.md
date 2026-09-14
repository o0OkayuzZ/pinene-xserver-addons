# Zombie Gear FINAL：腐敗・同調報酬の更新

これは `a9929d9a` 時点の旧仕様の記録です。現行仕様・検証結果は [FINAL_MAIN_UPDATE.md](FINAL_MAIN_UPDATE.md) を参照してください。各部位独立変換・同調報酬・段階別夜間回復は後続依頼により置き換えられています。

基準：`e5b7ef42de070f7ce9729bb7cf94b22d5a78d239`。
`handoff/`、`IMPLEMENTATION_REPORT.md`、既存`engine-smoke.log`は基準実装時点の記録として保持している。

## 仕様

- 実効Cは4部位の最低値。混在時もフルセット扱い、残機上限は常に`4−effectiveC`。
- 蘇生成功時は各部位のCを個別に＋1、C4で停止。浄化成功時は各部位を個別に−1、C0で停止する。装備の段階差を維持し、全てを実効Cに統一しない。
- 浄化は既存の8秒チャージと各種中断条件を維持。実効C0/残機4でも高Cの部位が残っていれば浄化できる。この場合は残機4のまま幹細胞1個を消費。全4部位C0/残機4では開始しない。
- 夜間回復は満腹度8以上で有効。C0/C1/C2/C3はそれぞれ1/2/3/4秒ごとに1HP、C4は0。戦闘中も有効。昼・満腹度不足・部分装備・満タン・死亡時はカウンターをクリアし、実効Cが変わった時も新しい間隔で数え直す。
- 同調数は**腐敗進行前**の装備から、最低Cと同じ部位の数を数える。

| 同調 | 蘇生HP | Speed | Absorption | Resistance |
|---|---:|---|---|---|
| 1 | 8 | II・3秒 | 追加なし | 追加なし |
| 2 | 16 | II・3秒 | I・4秒 | 追加なし |
| 3 | 32 | II・3秒 | I・4秒 | I・4秒 |
| 4 | 64 | III・4秒 | I・4秒 | II・4秒 |

全同調で炎上解除、native KB耐性100%を3秒。HPはポイントでありハート数ではない。追加Strengthなどの火力報酬はない。既存の常時Strength＋1は維持する。

## 安定化処理との接続

- item生成時のmetadataコピーと4部位一括変換・rollbackを維持。変換先の計算だけを部位ごとの加減算に変更。
- HP書き込み成功を確認して残機を減らす。残機書き込みも読み戻して確認し、失敗なら元の装備・HP・残機へ戻す。
- 浄化では幹細胞スタックも事前にcloneする。インベントリ書き込みが変更後に例外を投げるケースでも、元の装備・幹細胞・残機を復元する。浄化によるHP変更はない。
- 致死判定、仮適用前HPへの補正、Player Entity scoreboard、死亡済みEntityでの消費拒否は維持。
- 旧Absorptionのnative精算を行ってから蘇生報酬を付与する。同じamplifierへのnative更新がeffectAddを発火しない場合も、新しい報酬の4HPを追跡へ反映する。旧精算の遅延afterイベントで新しいシールド記録を消さない。
- 通常ダメージに対するcancel/直接HP減算は追加していない。HP80/native KBの定義、Strength/Health Boost管理、diet、感染計算、日光処理、画像・モデルは変更していない。
- 効果付与には引き続きnative addEffectを使用し、外部Effectの強度を下げるためのremoveEffectは追加していない。既存効果と重なる場合の優先順位はnativeに従う。

## 変更ファイル

`behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/scripts/`：

- `main.js`：部位別変換、夜間再生カウンター、同調判定、HP・バフ報酬、取引失敗時の復元。
- `rules.js`：腐敗別回復間隔と同調報酬表。
- `combat.js`：旧シールド精算と新しい報酬シールドの付与順序・追跡。
- `controls.js`：混在C0/残機4でも残りの高C部位を浄化できる操作条件と案内。

`tools/zombie_gear_v4/`：

- `test_gameplay.cjs`：既存テストの期待値を更新し、夜間再生・部位別変換・同調1〜4・rollback・シールド境界のテストを追加。
- `engine-final-smoke.js`：HP64と新しい報酬、各部位C、戦闘中の夜間回復、混在浄化を確認する実機プローブを更新。
- `update_engine_test.py`：検証用エクスポートを実機プローブに合わせて更新。

`docs/zombie_gear_final/`：`SYNCHRONY_UPDATE.md`、`synchrony-tests.log`、基準報告からの案内リンク。

## 検証

- ゲーム処理mock：**75件合格**。基準47件を含み、変更仕様に対応する期待値へ更新。
- アセット検証：**126 JSONと既存20 item/modelの検証に合格**。
- production scripts：`@minecraft/server` 2.6.0型定義によるTypeScript checkJsに合格。
- 実機プローブ：JavaScript構文検査に合格。
- `git diff --check`：合格。

今回の新仕様は実機では未実行。基準コミット時の実機44項目合格を、今回の実機合格数として転用していない。

## 残る実機確認

1. 同調1〜4の実際の致死攻撃→HP8/16/32/64、各バフのamplifier・継続時間、炎上解除とKB完全耐性3秒。
2. 蘇生前の外部Absorptionが残っているケース、同一tickの連続攻撃、既存の強い/長いSpeed・Resistance・Absorptionとのnative優先順位。
3. C0〜C4の夜間回復間隔、戦闘継続時と満腹度境界、昼夜切替・装備切替。
4. 混在装備での実際の8秒浄化、中断、C0/残機4の高C部位浄化、変換後の耐久・エンチャント・metadata。

`update_engine_test.py`は検証専用ワールドを閉じてから使う。更新済み実機プローブの混在浄化は`/scriptevent zombiegear:test_cleanse`で準備し、しゃがみを継続して確認する。Minecraftの操作競合を避けて実施する。

今回、パックUUID・manifest version・配布ZIPは変更していない。Gitのソース差分で更新するためのコミット。
