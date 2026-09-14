# Zombie Gear FINAL：main 統合仕様・検証

2026-09-13。ユーザーの最終指示に従い、最新実装ブランチの `a9929d9add7167df327acc4e198e7804847ab745` を基準に、添付の32項目の確定仕様を適用。取得した main は `08b41ef5`。基準実装 `e5b7ef42` の native HP80・KB・致死判定・Absorption・外部Effect・食事・metadata保持と、最新FINALの画像・モデルを引き継ぐ。

## 旧仕様・原因・変更後

| 対象 | 変更前と原因 | 現行 |
|---|---|---|
| 感染被ダメージ | 攻撃低下表の逆数を防御に流用 | 独立した `1 / 1.10 / 1.20 / 1.30` の値の配列。割り算なし |
| 感染III | フルセット攻撃時に追加×1.2 | 削除。感染由来の被ダメージ増加は×1.30まで |
| 腐敗攻撃 | 攻撃者がフル装備ならsourceによらず適用 | `entityAttack`、投射物なし、攻撃者本人がフル装備の場合のみ |
| 内部再適用 | beforeイベントには再入ガード、感染の除外はoverride causeに依存 | beforeの再入ガードを維持し、afterにもsynthetic印の明示的な除外を追加 |
| 腐敗変換 | 中間版では部位ごと±1 | 成功時に最低C±1へ4部位を統一。装備するだけでは変換しない |
| 蘇生報酬 | 中間版では同調数からHP8～64と段階別バフ | HP40、Speed II 3秒、炎上解除、native KB完全耐性3秒、既存音・赤フェード |
| 夜間回復 | 中間版ではCにより周期が変化、C4なし | 添付22・25項に従い基準FINALの全C共通1HP/秒。満腹度8以上、戦闘中も有効 |
| 書き込み失敗 | スコア書き込み例外が共通setterに吸収されうる | 読み戻し確認とrollback。幹細胞も書き込み後の個数確認 |

混在最低C・残機上限・防御11・native KB・HP80・食事とEffect保持は、旧mainのズレを改めて実装し直す代わりに、修正済み最新FINALから継承した。

## 現行ゲームプレイ

- 4部位すべてZombie Gearなら混在でもフルセット。`effectiveC=min(4部位)`。HP80、外部Strength+1レベル、食事・日光・Hunger・感染能力を維持。
- 腐敗の近接攻撃倍率はC0～4で `1.0 / 1.1 / 1.3 / 1.7 / 2.5`。外部Strength管理とは別処理。
- 感染者の攻撃倍率は `1.0 / 0.9 / 0.8 / 0.7`、感染者の被ダメージ倍率は `1.0 / 1.1 / 1.2 / 1.3`。既存の減衰時間、近接付与の40tickペア制限、牛乳解除を維持。
- 残機は `4-effectiveC` 以下。有効値は装備参照時点でclampし、scoreboard実値は毎tick補正する。C4の残機は0。
- 蘇生は残機−1・全4部位を最低C+1へ変換・HP40。`C4/C4/C4/C1 → C2/C2/C2/C2`。標準遷移は `C0/4 → C1/3 → C2/2 → C3/1 → C4/0`。
- 幹細胞は8秒しゃがみで最低C−1へ全4部位を浄化し残機+1、1個消費。現在capでも浄化可能。`C4/0 → C3/1 → C2/2 → C1/3 → C0/4`。C0は残機4未満で利用可能、成功時は4部位ともC0となる。
- 持ち替え・しゃがみ解除・装備変更・戦闘でチャージ中断。変換失敗時は元の4部位・metadata・HP・残機・幹細胞を復元。
- 防御は全段階2/4/4/1。native KBは最低Cから0.40/0.56/0.72/0.88/1.00。回復後3秒は1.00。
- 全Cで夜間1HP/秒。腐肉のnative栄養・HP+8・耐久10%修理、通常食とcakeの栄養ロールバック、食料固有バフ許可、Regeneration/Instant Health禁止、Absorption許可を維持。

## 今回変更したファイル（a9929d9aとの差分）

BP=`behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1`。

- `BP/scripts/rules.js`：感染表、同調報酬・段階別夜間周期の削除。
- `BP/scripts/combat.js`：近接source判定共通化、synthetic guard、固定HP蘇生に対応した既存Absorption処理。
- `BP/scripts/main.js`：成功時の全4部位統一、HP40、夜間1HP/秒、書き込み確認とrollback。
- `BP/scripts/controls.js`：浄化開始条件・説明を統一仕様へ。
- `tools/zombie_gear_v4/test_gameplay.cjs`：旧期待値置換、source別・感染倍率・混在・rollback等の回帰テスト。
- `tools/zombie_gear_v4/engine-final-smoke.js`：HP40期待値、native source別検証プローブ。
- `tools/zombie_gear_v4/update_engine_test.py`：検証ワールド用export更新。
- `docs/zombie_gear_final/IMPLEMENTATION_REPORT.md`：現行報告への案内。
- `docs/zombie_gear_final/SYNCHRONY_UPDATE.md`：旧中間仕様であることを明記。
- `docs/zombie_gear_final/FINAL_MAIN_UPDATE.md`：本報告。
- `docs/zombie_gear_final/final-main-tests.log`：今回の自動検証記録。

mainへの統合には、上記に加えて既存のe5b7ef42/a9929d9aのZombie Gear FINAL差分を含む。他addonへの変更はない。

## 検証結果

- ゲームプレイAPIモック：**106件成功**。全C近接倍率、矢・クロスボウ・投擲トライデント相当source、projectile付きentityAttack、DOT・炎上・爆発・魔法・環境・override・特殊sourceを確認。
- 感染III：感染者に通常10ダメージなら13、C4近接なら32.5、C4投射物なら13。追加×1.2なし。攻撃低下との積も別計算で確認。
- 内部致死再適用：腐敗・感染攻撃・感染被ダメージの積を一度だけ適用し、感染付与を再実行しない。
- 全4スロットの書き込み失敗、metadata作成失敗、HP・残機・幹細胞書き込み失敗を注入し、全装備・耐久・エンチャント・名前・Lore・lock・keepOnDeath・canDestroy/canPlaceOn・dynamic property・リソースの復元を確認。
- FINAL検証：**126 JSON、20アイコン・モデル・防具、native KB、登録整合性が成功**。
- 本番スクリプト：`@minecraft/server 2.6.0` 型チェック成功。
- リポジトリ `npm test`：**101件成功**（15+15+2+8+17+44）。
- 共通 `tools/validate.py`：既存の他addonリリースsnapshot不一致で停止。`bp_02/.../golden_foods/capabilities.js` は取得済みorigin/mainと同一SHA256だが、2026-09-10の固定snapshotと不一致。今回の変更によるものではない。根拠hashはログに記録。対象外addon・snapshotは変更していない。

## 実機・ログ・不確定要素

今回の変更後のMinecraft実機テストは**未実施**。新しいcontent.logも採取していないため、新規エラーなしとは断定しない。既存`engine-smoke.log`と画像は基準e5b7ef42時点の検証であり、今回の合格記録ではない。

残る実機確認は実際の剣・素手・斧・弓・クロスボウ・トライデント、他addon特殊攻撃、native armor/enchantment/absorption下の致死判定、混在セット変換とチャージ中断、Speed/KB/演出、同居addonのEffectとplayer.json競合、content.log。

sourceに正しく非近接causeまたはprojectileが付く攻撃への腐敗・感染付与の漏れはテストで排除した。ただし、他addonが通常近接と全く同じ `entityAttack + 装備者本人 + projectileなし` を指定したscripted damageは、このイベント情報だけでは実近接と区別できない。内部syntheticは専用ガードで区別する。外部addonが同一sourceを偽装する場合の完全な識別や、エンジンがrollback書き込みも継続的に拒否する場合の原子的復元は保証できない。
