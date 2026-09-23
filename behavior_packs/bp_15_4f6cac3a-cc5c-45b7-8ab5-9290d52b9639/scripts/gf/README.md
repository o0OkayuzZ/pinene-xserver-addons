# Pinene GF v0.3 / Collection & Combat Feedback

GFは引き続きBP15にあります。v1保存形式・本番カードPhase 1を維持し、所有コレクションと通常構築UI、エンジン実ダメージの表示を追加しました。BP17内部moduleのimportや既存PvP能力の複製は行いません。

## 起動とケース

BP15の `scripts/main.js` が従来どおり `gf/index.js` を一度importします。開発用の準備はプレイヤーとして以下を実行します（コマンド権限が必要）。

```text
/scriptevent pinene_gf:menu
/scriptevent pinene_gf:give_cases
/scriptevent pinene_gf:grant black_flash_arrow 1
/scriptevent pinene_gf:grant railgun 1
/scriptevent pinene_gf:grant accelerator 1
```

`menu` の番号入力式デッキ構築はdebug/admin fallbackです。v0.3ではここでも所有枚数の検証を省略しません。ケースから通常の「カードコレクション」「デッキ構築」へ進めます。固定枠の解放や所有カードの付与・削除はケースから行えません。`grant` はコマンド実行権限のあるplayer用の検証経路です。test cards・0/負数/不正な枚数は付与できません。`grant_starter` は実装していません。

`give_cases` は下記の正式4ケースを1個ずつ付与します。現在のインベントリに所持済みのケースは追加せず、不足分だけ付与します。不足分を全部入れられる空きスロットがなければ何も変更しません。地面への放出・既存アイテム上書きはありません。途中でインベントリAPIが失敗しても、再実行時は既に入ったケースを重複付与しません。player以外の実行元は無視します。

| ケースID | 操作 |
| --- | --- |
| `pinene_gf:case_active_attack` | 5枚handの攻撃カードとfixedAttackを表示・使用、攻撃カード詳細 |
| `pinene_gf:case_active_defense` | 5枚handの防御カードを表示、選択でarmManual |
| `pinene_gf:case_auto_defense` | autoDefense最大9枚を登録順で確認。構築から追加・削除・順序変更 |
| `pinene_gf:case_auto_attack` | 「自動攻撃システムは未実装です」の表示のみ。戦闘state変更・自動発射なし |

能動攻撃・能動防御・自動防御からCollectionとデッキ構築へ進めます。4ケースともmax stackは1、使用時に消費しません。譲渡してもデッキやカード所有権は移りません。

mainの32×32正式テクスチャとatlasをそのまま使用します。旧Random/Fixedアイテム定義とplaceholder依存は追加しません。Random Deck / fixedAttack / autoDefenseは既存の内部構成です。

基準mainはAuto Repair統合後の `0f7d5acf6b1169e22eb71160a52b1d3febda674b`。BP15 1.0.79→1.0.80、RP02 1.0.67→1.0.68、依存連鎖によりBP09 1.2.14→1.2.15、RP07 1.2.15→1.2.16。Crossbow機能は変更せず、両world登録・README・website registryを同期しています。

## 手札と固定攻撃

能動攻撃・能動防御の表示は既存5枚BattleStateをcategoryで絞り、選択を元のhand slotへ戻します。内部のランダムデッキは正確に16枚、同名最大3枚です。cardLabelにcategory・attributes・effect概要を表示し、山札・捨て札枚数と手動防御待機状態も維持します。

即時攻撃は選択確定時の24 blocks以内の視線先を対象にします。超電磁砲は中央設定の射程（初期64）でチャージ開始時と完了時に視線を取得します。対象なしではカードを使用せず、BattleStateも書き換えません。即時攻撃は `combat.useHand()` → `decks.use()`、チャージ攻撃は予約後に同じ同期journalへ進みます。使用位置だけ1枚補充し、山札が空になったら捨て札をshuffleします。

防御カードを選ぶと既存のmanual defenseとして構え、手札上に保持します。非対応の属性では消費せず、対応攻撃で防御が評価されたときに1回消費・補充します。対象がいなくても構えられます。

固定攻撃は初期1枠、進行側で解放した場合は最大3枠です。何度でも使え、random hand・drawPile・discardPileを消費しません。能動攻撃ケースは解放済みcapacityと登録内容だけを表示し、未解放枠を利用できません。

autoDefenseは最大9枚、構成の上から順に表示・評価します。デッキ構築では追加・削除・順序変更が可能です。対応しない属性はスキップし、damageが0になれば後続を評価しません。`manual_first` / `automatic_first` は既存構成の設定に従います。固定攻撃・自動防御を消耗式に変更していません。一方通行はmanual専用のままです。

## Collection / ownership

`pinene_gf:collection_v1` は `{version:1, revision:1, cards:{"gf:black_flash_arrow":2}}` の形で保存します。collectionはcardId→枚数だけを持ち、copyIdは保存しません。未作成のloadはrevision 0の空コレクションを返し、保存しません。破損した保存値は初期化せずエラーにします。

`collection/CardCollection.js` の公開操作は `load/count/grant/revoke/has/availableForDeck/allOwned` です。grant/revokeは登録済みproduction cardと正の安全な整数だけを受け付けます。新しい値を組み立てて単一dynamic propertyへ保存し、可変キャッシュを持たないため、setterの失敗でメモリ上だけ枚数が変わることはありません。revokeは現在の構成の使用数を下回る操作を拒否します。

新規configuration保存時はrandomDeck＋fixedAttack＋autoDefenseを合計し、cardIdごとに所有数以下、同名は全領域合算で3枚以下を要求します。現在の構成のロードではownershipを要求しません。collectionがない旧構成や、collection作成後も不足枚数のある旧構成はそのまま使用できます。自動grant・自動削除・強制migrationは行いません。変更/再保存時には必ず所有条件を満たす必要があります。

`index.js` の本番DeckManagerにはcollectionを必ず注入しています。既存の純粋コア試験用にはcollection未注入のDeckManagerも残していますが、ケース・debug編集のruntime経路には使用しません。

### 通常構築フロー

1. 能動攻撃・能動防御・自動防御ケースから「カードコレクション」でproductionカードの所有・使用・残り枚数を確認。未所有は「未入手」。test cardsは表示しません。
2. 「デッキ構築」からrandom/fixed/autoを選び、所有カードから追加、登録カードを削除、順序を変更。
3. 編集はメモリ上の `DeckDraft` のみ。未完成の16枚未満でも編集できますが、保存できません。
4. 保存時に構成revision・collection revision/保存値・固定capacity・session/dimensionを再検査。有効な現構成は、検証が通るまで上書きしません。

コレクションと構築はピネディメンション外でも利用できます。戦闘のdimension gateは維持します。
**現在のproductionは3種類なので、同名3枚では最大9枚です。通常入手カードだけで16枚を完成するには今後のカード追加が必要です。** 制限を緩和したり埋め合わせカードを追加したりしていません。legacy loadoutは継続使用できます。

### 取得API

同じBP内の将来の報酬処理は、runtime購読を起動しない `gf/api.js` を利用できます。

```js
import { grantCard } from "./gf/api.js"; // callerの位置に合わせて相対パスを調整
grantCard(player, "gf:black_flash_arrow", 1, { source: "debug" });
```

保存成功後にだけ取得通知・ログを出します。通知失敗を取得失敗として再試行しないよう、通知例外は保存成功結果を覆しません。sourceはログ用で、権限判定や所有枚数を変えません。別BPからの直接JS importはしません。ダンジョン・shop等とのcross-pack bridge、報酬テーブル、通常入手経路は未実装です。

## GF Damage Number

表示経路はGF計算→防御/反射/貫通→`applyDamage`→`entityHurt.damage`です。カード定義のdamageを実ダメージとして表示しません。ケースの旧「計算値 damage」メッセージは廃止し、実行通知だけにしました。

`feedback/DamageTickets.js` はapplyDamage直前にsource/target/card/effect/attributes/reflected/nonce/createdTickを持つticketを作ります。server 2.7.0のbeforeHurt（read-only利用）で呼出し中のticketへ関連付け、afterHurtの実数値で1回consumeします。GF外のmagicイベントはFIFOの区切りとして扱い、GFラベルを出しません。通常の剣・弓・Mob攻撃は表示対象外です。beforeHurtでdamageやcancelを変更しません。

ticketは2tickで失効、最大256件。cleanupは追跡中のレコードだけに対する単一one-shot timeoutで、idle時は停止します。before/afterの対応が取れない・期限超過・上限超過の場合は表示を抑制し、推定値へfallbackしません。実機でイベント順序と通知時期を確認する必要があります。

`pinene:gf_damage_number` は空geometryの専用ラベルです。対象のnameTagを変更しません。collision/重力/AI/dropがなくdamage_sensorで無敵、`minecraft:transient` により保存しません。頭上へ生成し、5tick後に太字解除、entityのtimer→instant_despawnで25tick後に消えます。script側の寿命timeoutは上限カウンターの解放だけです。表示対象一覧を毎tick走査しません。

`feedback/config.js` で色閾値、ticket寿命、上限、太字時間、位置を設定します。ラベル寿命を変更する場合はentity JSONのtimer秒数と合わせて変更してください（テストが整合を検証）。初期色は4未満赤、10未満gold、20未満黄、50未満緑、100未満aqua、それ以上pink。小数は最大2桁、末尾の0は省略します。

完全防御は防御側にBLOCKだけを出し、0 damage ticketを作りません。一方通行は元targetにBLOCK、反射先にengineが報告した実ダメージを表示します。超電磁砲は各targetに独立した数値を出します。target dummyは測定のみ行い、既存BP08表示を優先してGFラベルを抑制します。BP08のJSはimport/変更していません。

同一targetは25tick内で最大3個、全体は最大96個。超過hitも測定しますがラベルを抑制します。追加actionbar/HUDはありません。致死hitでtargetが消えた場合は取得済みの頭上位置を使います。

## Architecture: Before / After

| 項目 | v0.1 | v0.3までの変更 |
| --- | --- | --- |
| 通常操作入口 | 開発用script eventメニュー | 正式4ケース（自動攻撃は予約） |
| デッキ構築 | 番号入力式debug UI | 通常所有カードUI＋所有検証付きdebug fallback |
| UIと選択処理 | CardMenu内で視線取得・combat呼出し | `CaseActions` に共通化 |
| 古い画面の拒否 | BattleState比較、編集時revision確認 | v1保存値比較＋dimension/session identity確認 |
| runtime復旧 | spawn＋20tickごとに全player走査 | 初回一度、spawn、dimension change、GF操作時 |
| deck/combat/persistence | v0.1実装 | v1形式・16枚/5手札を維持。Phase 1はcombatに効果処理、deckに予約guardを追加 |

```text
case custom component onUse
  → Runtime.js（次tickへ移行・入力重複抑制）
  → CaseMenu.js（表示・選択、debugと共有のフォームlock）
  → CaseActions.js（stale確認・read-only preflight・視線対象）
  → 即時: CombatResolver → AttackEffects / DefenseEffects → 既存同期DeckManager
  → charge: PendingActivations → ActivationResources → 完了時に同じ同期経路
```

`index.js` は `registry` / `decks` / `combat` / `actions` / `activations` を公開します。`actions.useHand(player, slot, snapshot?)` / `actions.useFixed(player, slot, snapshot?)` はUIを呼びません。即時カードは同期結果、チャージカードは同期的に `{ pending: true }` を返します。UIを伴う呼出しは `actions.snapshot(player)` の結果を必ず渡します。`decks.use()` にPromiseを渡すことは禁止のままです。

表示中にhand・draw/discard・configurationRevision・manual defense・fixed slot capacityが変われば選択を拒否します。spawn、退出、dimension移動では一時的identityも無効化するため、別dimensionへ出て戻ったあと、保存値が同じでも古い画面を使えません。case/debug全体で1 playerにつき1フォームだけを開きます。UI identityは保存形式に追加しません。

## 保存と復旧

既存4キーのversion・データ形状はv0.1のままで、migrationは不要です。Phase 1は独立した予約・cooldownキーを追加します。

| キー | 内容 |
| --- | --- |
| `pinene_gf:configuration_v1` | version、configurationRevision、randomDeck / fixedAttack / autoDefense、settings |
| `pinene_gf:battle_v1` | version、configurationRevision、drawPile、hand、discardPile、resolving |
| `pinene_gf:manual_v1` | 手動防御のcopyIdと構成revision |
| `pinene_gf:fixed_slots_v1` | 固定攻撃capacity。未設定は1、最大3 |
| `pinene_gf:pending_activation_v1` | 予約中のkind/slot/cardId/copyId/revision/dimension。手札の別所有者ではない |
| `pinene_gf:cooldowns_v1` | cardIdごとの再使用可能UTC時刻（ms）。reload後も保持 |
| `pinene_gf:collection_v1` | version/revision、cardId→owned count。copyIdなし |

BattleStateはcopyIdだけを参照し、resolving中だけ使用枠がnullになります。所有検証に通った同一構成の保存はno-opです。旧画面からの構成保存はexpectedRevisionとsnapshotで拒否します。破損BattleState・revision不一致の修復、Configuration自体が不正なら元データを保持して停止する方針も維持しています。

カード使用は「resolving保存→同期効果→捨て札・補充保存」です。中断時は入場後に効果を再実行せず、捨て札・補充を完了します。効果実行直前の中断では効果が発生しない場合があります。同期効果自体が失敗した際のv0.1の終了処理も変更していません。Minecraftのワールド保存前に起きるプロセスクラッシュまで保証するものではありません。

### Dimension gateとpolling削除

`pinene_pvp:pvp_island` 外では抽選・補充・戦闘・BattleState修復を実行しません。debugから構成を編集した場合も再構築は次回入場まで保留します。正常なrelog/re-entryはhand・draw・discardの順序を維持します。

BP15の依存先 **@minecraft/server 2.7.0** の公式配布型定義で `worldLoad`、`playerSpawn`、`playerDimensionChange`、`playerLeave`、startupのitem custom component登録と `onUse` の存在を確認しました。API依存versionの変更やbeta API追加はありません。

- `worldLoad` とmodule load直後の一度きりの `system.run` が、同じ復旧済みフラグを共有します。通常起動では成功した全player取得は1回。早期実行でAPI未準備ならworldLoad側が担当し、script reloadではone-shot側が担当します。
- `playerSpawn`、`playerDimensionChange` はそのplayerだけを復旧します。dimension外ではロードを省略します。
- ケース・debug操作時にも既存 `decks.load()` が復旧します。
- `playerLeave` はUI/error情報とcharge予約を掃除します。デッキ・手札・cooldownは保持します。退出後に予約キーを消せなかった場合は次回spawn/reloadで解除します。
- **GFの周期pollingは0件です。** 従来の毎秒1回（約60回/分、3,600回/時）の `world.getAllPlayers()` と、そのたびのactive player数分の `decks.load()` を削除しました。新方式はイベント・操作に比例します。BP15の他機能のpollingは今回の対象外です。

## Test cardsと本番Phase 1

元の6種類を削除・変更していません。

1. Test Attack（colorless・10 damage）
2. Red Attack（red・10 damage）
3. Blue Attack（blue・10 damage）
4. Red Shield（red完全無効）
5. Blue Shield（blue完全無効）
6. Colorless Guard（全5属性・50%軽減）

旧test cardsの番号1〜6は既存構成と自動テストの互換用です。通常grantからは取得できません。既存のtest-card loadoutは使えますが、新規保存にownershipの例外はありません。対応属性は既存どおりcolorless / red / blue / yellow / purpleです。

本番カードはtestCardsとは別の `cards/attack/productionCards.js` / `cards/defense/productionCards.js` に宣言的に定義します。`CardRegistry.all({ includeTests: false })` は本番3枚だけを返します。既存デッキ互換のためtest cardの登録自体は残しています。

| ID / 名称 | 属性 / 操作 | Phase 1効果 |
| --- | --- | --- |
| `gf:black_flash_arrow` 黒閃の矢 | purple / attack / manual | 威力を2.5乗系で増幅。`min(cap, baseDamage ** exponent * scale)` |
| `gf:railgun` 超電磁砲 | yellow / attack / manual | チャージ完了時の直線上へ貫通攻撃。ブロックは貫通しない |
| `gf:accelerator` 一方通行（旧名:逆流の鏡） | purple / defense / manual | 紫に対応するGF攻撃を完全無効化し、その時点のダメージをsourceへ反射 |

属性は対応判定tagのみで、色相性によるダメージ倍率はありません。一方通行はPhase 1では自動防御欄へ登録できません。複数枚を手動で構えられ、非対応攻撃では保持します。定義の `modes.thrown.enabled=false` は将来の投擲用の入口で、投擲発動や未確定ダメージは追加していません。

### 中央balance（すべて暫定、`cards/balance.js`）

| 設定 | 初期値 |
| --- | --- |
| 黒閃 baseDamage / exponent / scale / cap | 8 / 2.5 / 0.1 / 40 HP（標準出力約18.102 HP） |
| 超電磁砲 maxRange / chargeTicks | 64 blocks / 40 ticks（20 TPSで約2秒） |
| damage curve | base 12 → fullCharge 24、curveExponent 1。Phase 1は満充電だけ発射 |
| maxTargets / penetrationMultiplier | 3 / 0.75（満充電で24,18,13.5 HP） |
| cooldownTicks | 100（20 TPS換算5秒をUTC時刻で保存） |
| ammoItemId | null（開発モード、消費なし） |
| 一方通行 reflectionMultiplier / maxReflectionDepth | 1 / 1 |

黒閃の `powerDamage(baseDamage, exponent, scale, cap)` は負値・NaN・Infinityを拒否し、巨大な有限入力でもcap内の有限値を返します。呼出し側から元ダメージを入力できます。超電磁砲の弾IDに有効な既存item IDを設定すると、発射1回につき1個消費します。正式な電磁硬貨アイテムは未追加です。射程64と黒閃exponent 2.5以外のバランス数値、紫のみという一方通行の対応範囲、貫通・照準仕様は今後調整可能です。

### Effect engine / AttackContext

`EffectRegistry` がeffectパラメータを検証し、`AttackEffects` / `DefenseEffects` が純粋計算、`PendingActivations` / `ActivationResources` がスケジュール・raycast・弾・cooldownを担当します。カード定義にMinecraft API処理はありません。

AttackContextは `damage/baseDamage/attributes/source/target/cardId/effectType/reflected/reflectionDepth/metadata` を持ち、従来の `{damage, attributes}` も受け付けます。防御優先順位と完全無効時の打切りは維持します。反射は元攻撃の同期journal終了後にGF `receive()` へ渡すため、攻撃者自身の手動防御も正常に消費・補充できます。反射済み攻撃は無効化できても再反射しません。属性ダメージ倍率やvanilla攻撃の横取りは導入していません。

### Async予約と中断

1. ammo・cooldown・射線・card/copyを検証し、手札を変更せず予約キーとplayer単位の予約を作成。playerあたりtimeoutは最大1件。
2. チャージ中は追加のカード操作・構成編集・予約枠の直接使用を拒否。以前に構えた別枠の防御は動作可能。
3. 完了時にsession・dimension・構成・hand・固定capacity・ammo・cooldown・射線を再確認。照準は完了時の視線を使い、途中追跡はしない。
4. 予約を解除し、randomカードは既存の同期 `decks.use()` でcommit。cooldown保存→弾1個消費→対象ごとの攻撃を実行。fixedカードはhandを消費せず同じ効果処理へ進む。
5. dimension移動・退出・spawnはtimeoutを解除。reload時の予約は再開せず取消し、v1 resolvingが残っていれば従来どおり効果を再実行せず補充する。

チャージ中に別枠の防御で手札が変化した場合も発射を取消します。target/ray無効、ammo不足、古いsessionなどの通常取消しはカード・弾を消費せずcooldownも開始しません。commit開始後の予期しないAPI失敗は再発動せず、v1仕様に従いカードを補充します。この場合カード/弾/cooldownの一部だけが消費済みとなる可能性があります。Minecraft保存の原子性やサーバープロセスクラッシュ直前の未保存状態は保証しません。

raycastは開始/完了時だけ。反射と貫通は発動時だけ。全player/entity/card stateの毎tick監視や常時HUDは追加していません。チャージ開始時にactionbarとメッセージを一度表示します。

取得APIは実装済みです。通常入手経路、報酬、recipe/loot/dungeon reward、電磁硬貨、投擲効果は未実装です。既存天雷の楔・神眼系・BP17能力との統合も行っていません。`cards/balance.js` はPhase 1から変更していません。

## 自動検証

```text
npm run test:gf
python -B -X utf8 tools/audit_pack_ownership.py
```

`test:gf` は既存release・ケース・runtime・productionと、新規collection・feedbackを実行します（156件）。GitHub Actionsでも同じコマンドを実行します。Node 22以降を使用し、実際の `gf/index.js` module graphを代替engine/UI APIでロードするため `--experimental-vm-modules` を指定します。Minecraft側でこのNodeフラグは不要です。

ケース定義・atlas、対象なし非消費、5枚handのカテゴリ別表示、手動/自動防御、固定攻撃、stale UI、16枚の循環、v1保存読込、resolving復旧、dimension/relog/reload、破損構成、重複購読、再帰damage、polling削除、安全なcase付与を検証します。

旧READMEが挙げていた `tools/test_gf_core.mjs` / `tools/test_gf_runtime.mjs` は基準main `67a5706b` には存在しません。基準mainで追跡されている既存GFテスト4件は変更せず、新しいテストと一緒に実行します。

## Engine / manual test checklist（未実施）

今回は実装・自動テストのみで、実ワールド切替、pack導入、deployを行っていません。以下は隔離した検証ワールドで確認します。

- BP15 1.0.80＋RP02 1.0.68で読込エラーがない。4ケースの名称・正式アイコン・stack上限1を確認する。
- playerから `give_cases` を実行し、各1個取得。再実行、全満杯、空き1枠、一部所持を確認し、既存アイテムが消えずpublic dropも発生しない。
- マウス・コントローラ・タッチでケースを使用し、非消費とUI表示を確認する。通常アイテムとhotbarを共用できる。
- 既存loadoutまたは将来の検証用所有カードで16枚を用意し、能動攻撃・能動防御に現在の5枚から該当カード・属性・山札/捨て札・manual待機表示が出る。
- 対象なし、範囲外、別dimension、対象退出時に非消費。対応targetへの攻撃で選択位置だけ補充する。
- manual defenseは非対応攻撃では残り、対応GF攻撃で消費・補充する。autoDefense順序・属性・優先設定・0 damage打切りを確認する。
- 能動攻撃の固定攻撃を繰り返してもhandが変わらず、自動防御ケースでautoDefenseを閲覧できる。構築メニューへ進めるが固定枠の解放操作はない。
- 表示中のGF被弾による手札変化、構成更新、退出→再入場、dimension往復では古い選択が拒否される。
- 正常なセーブ終了/relogとscript reloadで順序が変わらない。検証用にresolving保存を残した場合は効果を再実行せず1枚補充する。
- ピネディメンション外でケースを使ってもBattleState・damageが変わらず、再入場時に復旧する。
- BP17能力、GF以外のBP15機能、他アドオンの通常装備操作へ干渉しない。
- 本番カード番号7（黒閃）/8（超電磁砲）/9（一方通行）がdebug editorに表示され、対応する能動ケースにeffect概要が出る。
- 超電磁砲の40tickチャージ、64 blocks、遮蔽物、3対象貫通、5秒cooldown、発射時視線を実機確認する。
- テスト用ammo IDを設定し、所持なし・チャージ中の持出し・残り1個・複数対象時に消費/取消しが正しい。
- チャージ中のdimension往復、退出、script reload、サーバー再起動、被弾による手札変化で二重発射/複製がない。
- 一方通行同士・automatic_first/manual_first・非対応攻撃で無効化/反射/保持/補充が正しい。
- grant→collection表示、旧構成維持、通常構築・途中破棄・stale拒否を確認する。本番3種類だけでは16枚未達になることを確認する。
- armor/effect等でengine実ダメージが計算値と異なるケース、before/after eventの対応、連続攻撃・致死hit・普通のmagicとの混在で誤表示がない。
- 空geometryのnameTagだけが見えること、対象名を変更しないこと、5tick太字解除/25tick消滅/再起動時非保存を確認する。
- BLOCK、反射先実数値、Railgun3target、target dummy抑制、連続hit上限、HUD干渉なしを確認する。

API参照：
[transient](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_transient?view=minecraft-bedrock-stable)、
[EntityHurtAfterEventSignal](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtaftereventsignal?view=minecraft-bedrock-stable)、
[公式server 2.7.0配布](https://registry.npmjs.org/@minecraft/server/2.7.0)、
[WorldAfterEvents](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable)、
[EntityRaycastOptions](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityraycastoptions?view=minecraft-bedrock-stable)、
[interact_button](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_interact_button?view=minecraft-bedrock-stable)。
