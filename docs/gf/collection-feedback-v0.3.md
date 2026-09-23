# GF v0.3 Collection / Ownership + Damage Feedback

> Historical local implementation report. Versions, two-case item names, placeholder textures and pre-integration validation below describe the earlier local stage only. The current four-case integration and validation are documented in [four-case-integration.md](four-case-integration.md).

作業先: `_workspace/gf-card-cases` / `feat/gf-card-cases-v0.2`。
基準HEADは `67a5706bb79e951ddf975eebe24da6a2a7867eb4`。既存の未コミットv0.2・本番カードPhase 1を継続して実装しました。
コミット・push・PR・deploy・現在のMinecraftワールド操作は行っていません。

## Collection storage / API

保存キーは `pinene_gf:collection_v1`。例:

```json
{"version":1,"revision":1,"cards":{"gf:black_flash_arrow":2,"gf:railgun":1}}
```

cardId→所有枚数だけを保存し、copyIdは保存しません。copyIdは従来どおりdeck内の戦闘identityです。
未作成のloadは空の値を返すだけで書き込みません。破損データは勝手に初期化せず停止します。
grant/revokeは登録済みproduction cardと正のsafe integerだけを受け付け、0・負数・NaN・overflowを拒否します。
可変キャッシュを持たず、新しい値を単一propertyへ書き込むため、setter失敗時に旧値をメモリ上で破壊しません。

`CardCollection` は `load/count/grant/revoke/has/availableForDeck/allOwned` を提供します。
`availableForDeck` は所有数−現在の全領域使用数（最小0）です。同名上限による残枠は別途編集/保存時に検証します。
revokeは現在のconfiguration使用数を下回る操作を拒否し、configurationから勝手に抜きません。

同一BP内の取得APIは `scripts/gf/api.js` の `grantCard(player, cardId, amount, {source})`。
このmoduleのimportだけではruntimeのevent subscriptionは起動しません。
通知は保存成功後だけで、sourceはログ用途のみです。通知/ログ失敗が再grantを誘発しないよう成功結果を保持します。
別BPの将来機能とは明示的なbridgeが必要で、BP16/BP17からの直接JS importは追加していません。

## Ownership validation / legacy

新しい構成を保存するとき、randomDeck・fixedAttack・autoDefenseの同じcardIdを合計して所有数以下を要求します。
同名最大3枚も全領域合算で検証します。16 random、5 hand、fixed 1〜3、自動防御最大9、v1 journal・dimension gateは維持しています。
本番runtimeのDeckManagerにはcollectionを注入し、通常UIとdebug UIの双方で同じ検証を使います。
collection未注入の純粋コアテスト用DeckManagerは本番UI経路には使用しません。

現在の構成をロード/使用するときにはownership検証をしません。
collectionなしの既存構成も、collection作成後に枚数が不足する既存構成も保持して使用可能です。
ロード時の自動grant/削除/初期化/migrationはありません。編集・再保存時には所有条件が必要です。
既存configuration/battle/manual/fixed_slotsのキー・形状は変更していません。

## 通常UI / debug

Random/Fixed Caseから「カードコレクション」「デッキ構築」を開けます。戦闘dimension外やデッキ未登録でも所有UIは利用できます。
collectionはproductionのみ表示し、名前・属性・category・所有数・使用数・残り数・未入手を確認できます。
構築は領域選択→所有カードから追加/削除/順序変更→保存。編集中はメモリ内のdraftだけを更新します。
ランダム16枚未満は保存不可。保存時は構成/collection revision、固定capacity、session/dimensionの変更を拒否します。
一方通行はmanual専用なのでrandomには追加可能、autoDefenseには追加しません。

**現状productionは3種類、同名3枚なら最大9枚です。通常所有カードだけで16枚の完成には今後のproduction追加が必要です。**
制約を緩和したり仮の穴埋めカードを追加したりしていません。既存loadoutは継続使用できます。
自動テストはテスト内だけの追加定義で16枚の所有デッキ保存も検証しています。

debug/admin経路:

```text
/scriptevent pinene_gf:menu
/scriptevent pinene_gf:give_cases
/scriptevent pinene_gf:grant black_flash_arrow 1
/scriptevent pinene_gf:grant railgun 1
/scriptevent pinene_gf:grant accelerator 1
```

番号入力式debug editorは残し、ここにも所有検証を適用しています。
grantは有効なplayer実行元に限定し、コマンド権限はMinecraft側のscriptevent権限に従います。
test cardsはregistryに残しdevelopmentOnlyとして通常collection/grantから除外します。grant_starterは未追加です。
ダンジョンloot、Mob drop、shop、achievement、報酬テーブル、正式電磁硬貨、最終テクスチャは未実装です。

## Damage Number / Combat Feedback

BP08のtargetDummyを参照し、独立した `feedback/` moduleを実装しました。BP08を変更/importしていません。
damageは計算値ではなく `world.afterEvents.entityHurt.damage` を表示します。旧UIの計算値damageメッセージは実行通知へ変更しました。

- applyDamage直前にsource/target/cardId/effectType/attributes/reflected/nonce/createdTickのticketを作成。
- beforeHurtで呼出し中のGF ticketへ関連付け、afterHurtで消費。beforeイベントのdamage/cancelは変更しない。
- 非GFのmagicイベントはFIFOの区切りとして追跡し、表示しない。通常剣・弓・Mob攻撃は対象外。
- source/target/causeごとのqueueと1回consumeで同時攻撃を分離。2tickで失効し、最大256レコード。cleanupは追跡レコードだけのone-shot。
- 対応するbeforeイベントがない、遅延しすぎる、過負荷など、曖昧な場合は表示を抑制。推定値へfallbackしない。
- engineがapplyDamageを拒否した場合、ticketを捨てる。実ダメージが0以下なら数値を出さない。
- 完全防御はBLOCKだけ。反射元はBLOCK、反射先はengineの実数値。再反射防止を維持。
- Railgunの各targetへ独立表示。target dummyは測定だけ行いGFラベルを抑制。

ラベルは `pinene:gf_damage_number`。対象のnameTagは一切変更しません。
頭上に1hit1entity、空geometry、collision/重力/AI/dropなし、damage_sensorで無敵、transientで非保存。
最初の5tickは太字、その後通常、entity timerの1.25秒（25tick）でinstant_despawn。
表示上限は同一target3個、全体96個。超過hitの測定は続けてラベルだけ抑制します。
致死hitでは必要に応じて攻撃前の頭上位置を利用します。毎tick player/entity/label scanはありません。追加HUDもありません。

色閾値は `feedback/config.js` の独立pure functionで、<4赤、<10gold、<20黄、<50緑、<100aqua、100以上pink。
小数は最大2桁、末尾0を省略します。ラベル寿命の設定はentity JSONのtimerと同期が必要で、自動テストで検査します。

## 検証・version

- `npm.cmd run test:gf`: **139件成功、0件失敗**（既存/Phase 1 97、Collection 21、Feedback 21）。
- `python -B -X utf8 -m unittest discover -s tools/tests -p 'test_*.py' -v`: **4件成功**。
- `python -B -X utf8 tools/audit_pack_ownership.py`: **34 packs、成功**。
- `git diff --check`: 成功。
- `cards/balance.js` と本番3枚の定義ファイルはv0.3作業前のSHA256と一致。
- 他worktreeのauto-repair 19ファイル、PineCD 23ファイルはファイル一覧/SHA256一致。

BP15: **1.0.80→1.0.81**。RP02: **1.0.66→1.0.67**。
RP変更はラベルのclient entity/空geometry/render controller＋manifestのみで、PNG追加/変更なし。
BP15のRP02依存、BP09のBP15依存、両worldのBP/RP登録、root README、website registryを同期しました。
BP16・BP17・auto-repair/Lost & Found・PineCD・NF/Mycology・Golden Foodsのゲーム処理は変更していません。

## 残る実機確認

現ワールドは操作せず、実機テストは保留しています。自動テストはMinecraft APIのモックとJSON構造検証で、engine smoke testの代替ではありません。

- Content Log、空geometryでnameTagだけが表示されること、5tick太字解除、25tick消滅、非保存。
- before/after entityHurtの実際の通知順序・遅延、armor/effectで変わる実ダメージ、致死hit。
- 同時GF/非GF magic、反射、3target貫通、BLOCK、target dummy抑制、連続hit上限。
- grant/所有UI/旧loadout保持/途中編集破棄/stale拒否、ケースとチャージUIの干渉なし。

参考: [公式transient仕様](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_transient?view=minecraft-bedrock-stable)、
[公式entityHurt after event](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtaftereventsignal?view=minecraft-bedrock-stable)。
使用APIは既存のserver 2.7.0配布型定義で確認し、API依存versionは増やしていません。

## 今回の変更ファイル

v0.3開始時の未コミットworktreeとの差分を以下に列挙します。

- `README.md`
- `behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1/manifest.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/entities/gf_damage_number.entity.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/manifest.json`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/README.md`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/Runtime.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/api.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/collection/CardCollection.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/collection/DeckDraft.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/collection/OwnershipApi.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/combat/CombatResolver.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/CardRegistry.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/DeckManager.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/PendingActivations.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/CombatFeedback.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/DamageTickets.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/FloatingLabels.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/config.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/index.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CardMenu.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseActions.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseMenu.js`
- `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CollectionMenu.js`
- `docs/gf/collection-feedback-v0.3.md`
- `package.json`
- `resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/entity/gf_damage_number.entity.json`
- `resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/manifest.json`
- `resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/models/entity/gf_damage_number.geo.json`
- `resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/render_controllers/gf_damage_number.render_controllers.json`
- `tests/gf-collection.test.mjs`
- `tests/gf-feedback.test.mjs`
- `tests/gf-runtime.test.mjs`
- `website/src/data/pack-registry.json`
- `world_behavior_packs.json`
- `world_resource_packs.json`
- `worlds/Bedrock level/world_behavior_packs.json`
- `worlds/Bedrock level/world_resource_packs.json`
