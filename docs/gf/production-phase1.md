# GF Production Cards Phase 1

> Historical local implementation report. Versions, two-case item names, placeholder textures and pre-integration validation below describe the earlier local stage only. The current four-case integration and validation are documented in [four-case-integration.md](four-case-integration.md).

取得した最新mainは `67a5706bb79e951ddf975eebe24da6a2a7867eb4`。
未コミットのGF v0.2を保持したまま、`_workspace/gf-card-cases` / `feat/gf-card-cases-v0.2` で継続実装しました。
コミット・push・PR・deploy・実ワールド操作は行っていません。

## 実装結果

| カード | 属性 | Phase 1の効果 |
| --- | --- | --- |
| `gf:black_flash_arrow` 黒閃の矢 | purple | 手動攻撃。独立したpowerDamage関数で2.5乗系へ増幅 |
| `gf:railgun` 超電磁砲 | yellow | 手動攻撃。チャージ予約後に直線貫通攻撃 |
| `gf:accelerator` 一方通行 | purple | 手動防御。対応GF攻撃を完全無効化し、sourceへ反射。投擲モードは無効 |

属性は対応判定tagのみです。属性相性によるダメージ倍率はありません。
旧test cards 6枚は残し、本番定義を別ファイルに分離しました。
`registry.all({ includeTests: false })` で本番3枚だけを列挙できます。

## 効果エンジンと予約

`EffectRegistry` がeffect設定を検証し、`AttackEffects` / `DefenseEffects` がダメージ・無効化・軽減・反射を計算します。
`AttackContext` にbaseDamage、source、target、cardId、effectType、reflected、reflectionDepth、metadataを追加し、従来の単純attackも受け付けます。
反射は元の同期カード処理終了後にGF combatへ戻します。反射済みの攻撃は再反射せず、防御による無効化は可能です。

超電磁砲は手札を取り除かずcopyIdを予約します。playerあたりtimeoutは最大1件です。
開始時と完了時だけammo/cooldown/rayを確認し、完了時にはsession・dimension・構成・手札・固定capacityも確認します。
発射時の視線を使い、ブロックで射線を止め、距離順に対象を重複除去します。
予約中の追加操作と構成編集は拒否します。既に構えた別枠の防御は動作し、その結果手札が変わればチャージを取り消します。

commitは既存の同期 `DeckManager.use()` へ渡します。Promise禁止は維持します。
弾不足や通常の取消しではカード・弾・cooldownを消費しません。
発射時はcooldown保存→弾1個消費→攻撃を実行し、handカードは通常どおり補充します。
固定攻撃は手札を消費しません。

予約は `pinene_gf:pending_activation_v1`、cooldownは `pinene_gf:cooldowns_v1` に保存します。
既存のconfiguration/battle/manual/fixed_slotsキーとv1形状は変えていません。
退出・dimension移動・spawnで予約を解除し、script reload後は予約を再開せず取り消します。
既存resolving中断は効果を再実行せず補充する既存方式で回復します。
開始後の予期しないAPI失敗は再試行しません。commit途中の失敗ではカード/弾/cooldownが部分的に消費済みとなる可能性があります。
サーバー保存前のプロセスクラッシュまで含めたディスク永続化の原子性は保証しません。

全player/entity/card stateの毎tick走査はありません。v0.2で削除した20tick全player pollingも復活させていません。

## 現在の中央balance

数値の変更先は `scripts/gf/cards/balance.js` です。

| 設定 | 現在値 |
| --- | --- |
| 黒閃 baseDamage / exponent / scale / cap | 8 / 2.5 / 0.1 / 40 HP |
| 黒閃の標準出力 | 約18.102 HP |
| 超電磁砲 maxRange / chargeTicks | 64 blocks / 40 ticks |
| damage curve | base 12 → fullCharge 24、curveExponent 1 |
| maxTargets / penetrationMultiplier | 3 / 0.75（満充電時24,18,13.5 HP） |
| cooldownTicks | 100（5秒のUTC時刻ベース） |
| ammoItemId | null：消費なしの開発モード。既存item IDを設定すると1発につき1個 |
| 反射倍率 / 最大反射深度 | 1 / 1（反射済みは再反射しない） |

黒閃exponent 2.5と射程64以外のバランス数値は暫定です。
正式な電磁硬貨ID、一方通行の対応範囲（現在purpleのみ）、投擲効果・ダメージ、最終テクスチャ、取得・報酬は未確定/未実装です。
早期解放による部分チャージ発射は実装せず、Phase 1は満充電時だけ発射します。

## 検証

- `npm.cmd run test:gf`: **97件成功、0件失敗**。v0.2の57件＋Phase 1の40件。
- `python -B -X utf8 -m unittest discover -s tools/tests -p 'test_*.py' -v`: **4件成功**。
- `python -B -X utf8 tools/audit_pack_ownership.py`: **成功、34 packs**。
- `git diff --check`: 成功。
- auto-repair worktreeの既存変更19ファイル、PineCD worktreeの既存変更23ファイルは、保存済みのファイル一覧とSHA256が一致。
- RP、BP16、BP17、旧testCards、Persistence/CardState/RuntimeGate/HandManagerは変更なし。

テストは数値境界、通常補充、対象なし非消費、予約・二重発射防止、dimension/退出/reload/旧resolving復旧、弾不足/持出し/消費、対象重複除去、cooldown、相互反射、複数防御copy、priority、16枚/5手札/同名3枚/自動9枚/固定3枠を含みます。
Minecraft APIはモックであり、実機動作確認の代替ではありません。全アドオンの無関係なテストは実行していません。

BP15はv0.2の1.0.79から **1.0.80** へ更新しました（mainの1.0.78から累計+2）。
modules、world登録2箇所、BP09のBP15依存参照、README、website registryを同期しています。
BP09のゲーム処理は変更せず、RP02は1.0.66のままです。

## 残る実機確認

現在のワールドは操作していません。承認された隔離ワールドで以下を確認します。

- Content Log、ケースの利用入力・表示、本番3枚の説明。
- 黒閃の実ダメージ、超電磁砲の40tickチャージ・64 blocks射線・遮蔽物・3対象貫通。
- ammo IDを設定した実インベントリで、残数1個・不足・チャージ中の持出し。
- 5秒cooldown、チャージ中の退出/dimension往復/script reload/サーバー再起動。
- 一方通行同士の反射停止、手動/自動優先順、非対応属性、消費後の補充。
- BP17能力や他アドオンの通常操作に干渉しないこと。

詳細な構成・コマンド・チェックリストはBP15のGF READMEに記載しています。

## 変更ファイル

以下はmainとの差分です。未コミットのv0.2ケース・テスト・CI追加も含みます。

- `.github/workflows/gf-tests.yml`
- `README.md`
- `behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/manifest.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/items/gf_fixed_case.item.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/items/gf_random_case.item.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/manifest.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/README.md`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/Runtime.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cards/attack/productionCards.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cards/balance.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cards/defense/productionCards.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cases/CaseItems.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/combat/CombatResolver.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/combat/DefenseResolver.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/CardRegistry.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/CardValidator.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/DeckManager.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/ActivationResources.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/AttackEffects.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/DefenseEffects.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/EffectRegistry.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/PendingActivations.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/index.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CardMenu.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseActions.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseMenu.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/FormSessions.js`
- `docs/gf/card-cases-v0.2.md`
- `docs/gf/production-phase1.md`
- `package.json`
- `tests/gf-cases.test.mjs`
- `tests/gf-fixture.mjs`
- `tests/gf-production.test.mjs`
- `tests/gf-runtime.test.mjs`
- `website/src/data/pack-registry.json`
- `world_behavior_packs.json`
- `worlds/Bedrock level/world_behavior_packs.json`
