# Infinite Castle Phase 1 実装報告

基準: `42fc747426db0cf6e65eca77d73ae16fdf257188`
作業ブランチ: `implement/infinite-castle-phase1`
作業ディレクトリ: `C:/Users/はーにゃ。/.codex/worktrees/infinite-castle-phase1`

指定コミットから分離したチェックアウトに実装した。Xserverへの反映、push、元の開発パックへのコピーは行っていない。以下はコードと自動検証の報告であり、Minecraft実機での受け入れ完了を意味しない。

2026-09-11: 新規ローカルワールドで入城・guard戦闘・Wave 2・Resistance Vを実機確認。初回建築、到着先読み込み、安定版Block API、スポーン時の変身競合、被ダメージ軽減の不具合を修正。確認範囲は [実機テスト記録](local-smoke-test.md) を参照。

## 1. 変更ファイル一覧

全パスは [validation.json](validation.json) の `changedFiles` に収録。主要な変更は次のとおり。

- Infinite Castle: manifest、Manager、入口演出、Demo進行停止、RoomMaterials、旧Encounterの互換入口、DynamicReconstruction、ReconstructionV2、既存3テストとMinecraftモック。
- Golden Foods: manifest、capabilities、main、既存runtimeテスト。
- Dungeons: Vanguard、Royal Guard、Necromancer、Wraith、Illusioner、Drowned Necromancer、Endersent、Enchanted Vanguard、Enchanted Royal Guardの9定義。Endersentの既存Scriptに管理対象除外を追加。
- BSL: manifest、既存validatorと検証レポート。
- Dungeons RP: manifestと、金色／深紅の鍵を描く専用particle 2種。
- rootおよび `worlds/Bedrock level` のBP/RP登録バージョン。UUIDと順序を保持。

| パック | 変更前 | 変更後 |
|---|---|---|
| Infinite Castle BP | 0.1.42 | 0.2.2 |
| Golden Foods BP | 1.0.32 | 1.0.33 |
| BSL BP | 1.0.15 | 1.0.17 |
| Dungeons BP / RP | 2.0.4 | 2.0.6 |

## 2. 新規ファイル一覧

全パスは [validation.json](validation.json) の `newFiles` に収録。

- `phase1Config.js`: 調整値、Mob、Wave、抽選、BSL table。
- `phase1State.js`: 部屋割当、instance、run、復旧の純粋ロジック。
- `phase1Runtime.js`: Encounter、cap、chest receipt、入口・出口、永続化、debug。
- `phase1Combat.js`: 全能力、予告、弾、座標hazard、鍵の飛翔。
- `phase1Sockets.js`: 固定socketと歩行形状の契約。
- `phase1Interiors.js`: Garden 3種、Vault 2種、出口陣の一度きりの装飾。
- `counterEffects.js`: Golden Foodsの持続counter。
- BSL loot table 7個、debug function 17個。
- Phase 1テスト6ファイル、Golden Foods counterテスト、専用static validator、本報告と検証JSON。

## 3. Architecture概要

Source Partsの既存生成・安全確認・phased/yield処理を基盤として利用する。Room MaterialにEncounter roleと内装variantを保存し、物理配置とEncounter stateを分離した。

category=roomの15室だけを数え、初回は入口1・出口1・6 Encounter保証・可変7室。可変枠はTreasury 3%、Garden 5%、通常92%。通常weightは26/19/19/17/19。Eliteは生存する固定室を含め最大1室。Phase 2 Bossは割当・Mob rosterに含めない。

永続台帳は `infinite_castle:phase1_v2`。Room instance、run ID、参加者、reward receipt、監守の2能力を保持する。5tickの中央combat更新、10tickのプレイヤー検出、100tickのEntity再照合を使い、Entityごとのintervalを増やさない。

再起動で破棄するEntity slotとspawn queueはメモリだけに保持し、32 KiBのdynamic propertyを圧迫させない。復旧に必要な撃破・報酬・部屋・参加者情報を永続化する。

## 4. BSL追加table一覧

BSL BPの `loot_tables/chests/infinite_castle/` に次を追加。

| Table | 対象 |
|---|---|
| guard.json | 衛兵 |
| curse.json | 呪術 |
| wraith.json | 怨霊 |
| heavy.json | 重装 |
| mixed.json | 混成 |
| elite.json | Elite |
| treasure_vault.json | 宝物庫 |

元の7テーブルを報酬量の基準として保持し、BSLの slots/ に1枠抽選用テーブル14個を生成する。ランダムな1枠を基本報酬で保証し、残り26枠は空欄を含めて独立抽選。food/collectibleは既存BSLテーブルをnested参照する。元の各poolの平均抽選回数を保つが、最低個数や少なくとも1回当たる確率は従来と異なる。実行は `loot replace block ... slot.container <slot> 1 loot "chests/infinite_castle/slots/<type>"`。

receiptはVersion 3。各枠の抽選位置・進捗・処理中マークを保存し、失敗時は未処理枠から再開する。再起動時の曖昧な空欄は再抽選しない。Version 2以降の配布済み報酬はアップデート後も再補充しない。旧版で誤ってstocked扱いされた空チェストの修復は維持する。

## 5. Mob / Encounter方式

6 Encounterを仕様どおりの2 Waveで構成。Wave 1のoriginal残存2体以下、または900tickでWave 2を開始し、Wave 1を消さない。召喚物はWave判定から除外。Wave開始時人数で追加0～3体、鍵持ちHP 1 / 1.15 / 1.30 / 1.45を確定する。

管理tag付きの既存Entityを利用する。Dungeonsには専用component group/eventを追加し、管理対象の既存groupを外してHP・攻撃・Script所有能力を適用する。通常Dungeons eventは管理対象以外で元の内容を実行する。通常スポーンのcomponents、既存group、event内容の保持を基準コミットとの比較で検証した。

Vanilla Mobにも専用health/attack groupとspawnEventを追加。before-hurtの有効HP換算は補助として保持するが、攻撃側の軽減後ダメージは上書きしない。Skeletonの矢とNecromancerの弾は所有者を限定した基礎ダメージgroupを使用する。通常Entityの定義やHPを一律に変更しない。デバッファーの弾は座標・速度・swept collisionで処理し、native projectileとの重複を除く。病巣はEntityではなく座標hazard。

6鍵持ちのCD・予告・範囲・低HP能力と3デバッファーの能力を実装。監守の異なる2能力はinstanceに固定。攻撃はentityAttack causeで行い、防具・Resistanceを無視する割合damageを使わない。

45体capには基本敵・人数追加・召喚・分身を含む。基本敵と鍵持ちを優先し、必要時は召喚を退場させる。未投入の基本敵はpendingとして残す。撃破後も残敵は続行。鍵は既存Dungeonsの金色particleで弧を描いてchestへ移動し、完了時に封印解除と報酬投入を行う。

## 6. Reconstruction / Socket

再構成間隔15分、protectionHops=0、候補seed最大4回。固定は現在いる区画、ANCHORED出口、Active Encounterと200tickの離室Grace。候補不成立時にはstationary fallbackで安全な可変区画を再配置する。

固定socketのOPEN/SEALED、位置、向き、floor normal、幅・高さ、walk lanes、sillを比較する。固定volume内のair/support/stair方向も比較し、隣接階段の変更で固定側の床が変わる候補を拒否する。低端・高端から3blockの傾斜に沿う床と頭上空間を検査。吹き抜け階段上端の2blockは既存構造のnavigation envelopeとして扱う。

seal、seam carve、support repairは固定側への書込みを避ける。fill前にEncounter保護を検査し、block/structureの変更直前にもprotection revisionを検査する。計画後に出口が発見された場合は中断して再計画する。既存のplayer clearance、scenery、整合性検査、復旧処理を維持する。

## 7. Run lifecycle

入口への転送はbuild完了・安全なlandingの取得後に行う。到着直前に60tickのEncounter開始猶予を予約する。入口が残る間は安全な入口を利用し、以後はDormant、Garden、Cleared等の安全候補を使う。

出口への入室でANCHOREDにする。中心の帰還陣で30tickしゃがむと、入口と同じ演出を使って個人の保存帰還地点へ戻る。しゃがみ解除・範囲外・死亡で待機を取り消す。転送中の死亡も通常帰還として記録しない。

全参加者が正常帰還したときだけ `ENDED_PENDING_REBUILD` にする。死亡・logoutでは参加状態を終了させない。次の入場は新しいrunと新しい城のbuild後。失敗時は外で再試行を待つ。

鍵撃破前の無人200tick / 再起動はDormantへ戻す。鍵撃破後はClearedにし、receiptを保持する。mutable室は実際の除去前にRetiredにし、同座標でも新しいinstanceを採番する。

## 8. Golden Foods capability

`cleanse_on_consume`、`prevent_effects`、`reduce_incoming_effect_duration`、`poison_to_regeneration` を有効化。宣言済みfoodデータを参照し、player dynamic propertyに有効期限とproc cooldownを保持する。

enchanted golden carrotのBlindness/Darkness対策、enchanted baked golden potatoのPoison無効とHunger/Nausea短縮、enchanted poisonous golden potatoのPoison→Regeneration変換を実装。effectAddのbefore eventでcancel/持続時間変更を行い、変換時の再生付与は次tickへ送る。同tickの多重procも予約mapで抑止する。

使用APIはMicrosoftの [EntityHurtBeforeEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtbeforeevent?view=minecraft-bedrock-stable) と [EffectAddBeforeEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/effectaddbeforeevent?view=minecraft-bedrock-stable) に基づく。Golden Foodsのserver依存を2.9.0へ更新した。無関係なdeferred capability、食品・recipe・textureは変更していない。

## 9. 自動test結果

- Infinite Castle: **39 PASS**。100seedの15室割当、保持・再抽選、Wave、全能力、25体以上の複数Encounterから45体cap、報酬、restart、run、転送キャンセル、socket候補の再探索、部屋・crossroads・階段の最小固定、到着先の一時ロード・解放・期限、preview API非依存の床・飛翔物判定を含む。
- Golden Foods: **44 PASS**。新規counter 4件と既存food/egg/chorus/guideの回帰テスト。
- 既存Dungeons boss reward: **4 PASS**。
- Minecraft APIはモック。loot testはnativeコマンドの呼出回数とreceiptを検証する。エンジンの実抽選・実ダメージ・chunkのロード挙動を再現したものではない。

実行例（Node 22）:

```powershell
# Infinite Castle BP内
node --experimental-loader ./tests/minecraft-server-encounter-loader.mjs --test tests/*.test.js
# リポジトリroot
node --test tests/golden_foods/*.test.mjs
python tools/test_dungeons_boss_rewards.py
python tools/validate_infinite_castle_phase1.py --node <node.exeのパス>
python tools/validate_bsl_phase05.py
```

## 10. Static validation

[Phase 1 validation](validation.json) と [BSL validation](../bsl/validation.json) に結果を保存。

Phase 1検証は指定基準コミット、変更JSON、JS構文・相対import、pack UUID/module UUID、registration順序・version、相互依存、管理HP/攻撃、通常Dungeons 9＋Vanilla 3＋弾2定義の分離、debug 17個を確認する。BSL検証は既存36 chest profile、追加7 table、参照解決・循環・item所有・Waystone非復活を確認する。

既存validatorのBSL履歴比較基準は旧Phase 0.5 provenanceのまま保持し、Phase 1専用validatorでは指定コミットを別途検証する。Windowsの改行差は内容改変と区別し、登録version更新はUUID/順序を含む意味比較で確認する。

## 11. 実機確認が必要な項目

- Content Logでserver 2.9.0、追加component/event、particle、lootコマンドが受理されること。
- 1～4人で全6 EncounterのHP/攻撃、防具・Resistance、telegraphの視認性、CD、3打撃での分身消滅、native能力重複の除去。
- 3～4室同時戦闘・30～45体と再構成を重ねたwatchdog/TPS。
- 階段の低端・高端、全方向、固定room/stair/crossroads隣接での実通行と固定block不変。実ワールドのblock signatureは未採取。
- 鍵の飛翔、chest UI、実loot内容、stocking中停止、chest修復、同座標再配置、restartでの重複なし。
- Gardenの見た目・直接回復、Vaultの見た目・既存価値blockも含む採掘/爆発防止。
- 出口でのしゃがみ中断、死亡/logout、保存帰還地点、全員帰還と次run、build失敗時の再入場。
- 食品counterの実際のeffectイベントと期限切れ、Poison変換の多重proc抑止。

## 12. 既知issue / 実装状況

仕様に含まれる機能を、未確認を理由に無効化した項目はない。実機受け入れ全体は未完了であり、上記項目を確認するまでは実機動作まで完成したとは断定しない。確認済みの範囲は実機テスト記録に分けて記載する。

代替実装は「Vanilla Mobの有効HP換算」「Script座標projectile/hazard」「一度きりの内装decorator」「既存金色particleの再利用」。これらはコードを実装済みで、ゲーム上の最終的な見え方・挙動が実機確認対象。

既知の制約は、すべての固定socket条件を満たす移動配置が見つからない場合にstationary fallbackになること、人数上限45体では基本敵がpendingになり得ること。報酬の投入失敗を補充済みとする問題はVersion 2で修正した。

2026-09-12のMob・鍵演出・空チェスト修正と実機確認: [3件の修正報告](three-fixes-20260912.md)。

2026-09-12の各枠抽選への変更: [BSL各枠抽選](slot-rewards-20260912.md)。今回はユーザー指定により内部テストのみ。
