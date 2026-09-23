# Pinene GF Card Core v0.1

## 起動・操作

`scripts/main.js` から `gf/index.js` を読み込みます。追加のパッケージ導入は不要です。
プレイヤーとして `/scriptevent pinene_gf:menu` を実行すると検証用メニューが開きます。
コマンド権限が必要です。カードケース4種は正式なアイテム／テクスチャ資産として追加済みですが、現時点ではデッキ保存や戦闘処理そのものには接続していません。

- 「デッキ構築」で、表示されたカード番号をカンマ区切りで入力します。
- ランダム枠は16枚、同名最大3枚。固定攻撃は初期1枠、自動防御は最大9枚です。
- 攻撃カードを選ぶと、24ブロック以内の視線先の対象にGF攻撃します。
- 手札の防御カードを選ぶと、次の対応するGF攻撃に備えます。非対応の攻撃には消費しません。
- 使用位置だけ補充します。固定攻撃と自動防御は、この版では繰り返し使用可能です。
- GF攻撃の防御順は、手動→自動です。完全無効化した時点で後続を評価しません。

## カードケース資産

採用した32×32のMinecraft向けカードケースを `RP02/textures/items/gf/cases/` に配置し、BP15に対応する4アイテムを登録しています。

| 区分 | アイテムID | 現在の扱い |
| --- | --- | --- |
| 自動防御 | `pinene_gf:case_auto_defense` | アイテム／ビジュアル登録済み。既存`autoDefense`との接続は今後 |
| 自動攻撃 | `pinene_gf:case_auto_attack` | 予約枠。自動攻撃ロジックの実装は未定 |
| 能動防御 | `pinene_gf:case_active_defense` | アイテム／ビジュアル登録済み。手動防御との接続は今後 |
| 能動攻撃 | `pinene_gf:case_active_attack` | アイテム／ビジュアル登録済み。攻撃枠との接続は今後 |

4アイテムはいずれも現在は機能を持たないケース本体です。カード構成の保存元は従来どおりdynamic propertyで、ケースを所持・破棄してもデッキデータには影響しません。

### テストカードと16枚の登録例

同名3枚上限を守って16枚を構成できるよう、承認済みのBlue Attack（青・10 damage）を追加しました。
登録カードは次の6種類です。自動テストも実際の登録カードを使用します。

1. Test Attack（無色・10 damage）
2. Red Attack（赤・10 damage）
3. Blue Attack（青・10 damage）
4. Red Shield（赤のみ完全無効）
5. Blue Shield（青のみ完全無効）
6. Colorless Guard（全属性50%軽減）

ランダム枠の入力例：`1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6`
固定攻撃の入力例：`1`。自動防御の入力例：`5,4,6`。

## 保存と復元

プレイヤーのdynamic propertyに保存します。アイテム・チェスト・カードケースは保存元ではありません。

| キー | 内容 |
| --- | --- |
| `pinene_gf:configuration_v1` | version、configurationRevision、3種類のデッキ、settings |
| `pinene_gf:battle_v1` | version、configurationRevision、drawPile、hand、discardPile、resolving |
| `pinene_gf:manual_v1` | 手動防御のcopyIdと構成revision |
| `pinene_gf:fixed_slots_v1` | 固定攻撃枠数。未設定は1、最大3 |

BattleState内のカード参照はcopyIdのみです。resolvingはcopyIdまたはnullです。
解決中はhandの使用位置がnullとなり、16枚の一意性を保ちます。
保存前・ロード時に総数・重複・所属・手札形状・revisionを検証します。

構成変更はrevisionを増やします。同一内容の保存は何も変更しません。
古い編集画面からの保存はexpectedRevisionによって拒否します。
破損BattleStateとrevision不一致はConfigurationから修復します。
Configuration自体が不正なら元データを残して停止します。初期構成で上書きしません。

`pinene_pvp:pvp_island` の外では抽選・補充・戦闘・修復を実行しません。
構成編集は可能ですが、BattleStateの再構築は次回入場まで保留します。
正常な再ログイン・再入場では手札・山札・捨て札の順序を維持します。

カード使用は「resolving保存→同期効果→捨て札・補充保存」です。
resolving中に中断した場合、入場後に効果を再実行せず捨て札・補充を完了します。
効果の二重発動を避ける方針で、効果実行直前に中断した場合はその効果が発生しないことがあります。
Minecraftのワールド保存前のプロセスクラッシュまで完全な永続性を保証するものではありません。

## 拡張用API

`gf/index.js` が `registry`、`decks`、`combat` を公開しています。

```js
// Configurationの配列には {copyId, cardId} を渡します。
decks.saveConfiguration(player, configuration, expectedRevision);
decks.load(player);
combat.useHand(player, slot, target); // slot: 0〜4。防御カードなら構える
combat.useFixed(player, slot, target);
combat.receive(target, { damage: 12, attributes: ["red"] }, attacker);
```

自動防御はこのGF戦闘経路で評価します。通常攻撃・既存の武器能力を
`entityHurt` 後の回復によって打ち消す方式は使っていません。
既存武器との接続は、属性付き攻撃を `combat.receive` に渡す形で追加できます。
GF固有能力を追加する際も `requireActive` を入口・効果直前に適用してください。

固定枠の解放は信頼された進行処理から `fixed_slots_v1` に整数1〜3を設定します。
UIには解放権限を与えていません。クールタイム付きカードはこの版にはありません。
デッキ編集は開発用の構成登録です。入手・報酬・未採用カードの所有一覧はまだ実装していません。

## 自動検証

```powershell
& '_workspace/mycology_runtime_tools/node/node-v22.23.2-win-x64/node.exe' --experimental-default-type=module --experimental-vm-modules --test tools/test_gf_core.mjs tools/test_gf_runtime.mjs
```

仕様TEST 01〜10、200回循環、退出中の修復保留、resolving復元、保存失敗、
再入防止、防御順、固定枠、属性、同一構成保存、Configuration破損を検証します。
26件成功。Blue Attackの攻撃・青盾での無効化、ランタイム読み込み・イベント登録・メニュー表示も代替APIで検証しています。
永続プロパティはメモリ上の代替実装で、Minecraft実機検証は未実施です。

API参照:
[Entity / dynamic properties](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)、
[ModalFormData](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server-ui/modalformdata?view=minecraft-bedrock-stable)。
