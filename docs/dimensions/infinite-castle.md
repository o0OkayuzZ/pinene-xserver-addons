# 無限城：XServer導入版

## 2026-09-11：部屋素材・癒やしの庭・宝物庫（Git更新）

- 通常部屋の樹皮を剥いだトウヒの原木を、中ボス・最終ボス部屋では深紅の幹、レア部屋では歪んだ幹へ置換。柱・梁の軸と他の建材は保持。
- レア率は報酬部屋候補ごとに5%の仮設定。その内訳は庭50%・宝物庫50%。部屋ごとの種類は保存し、保護された部屋の再抽選はしない。既存のレア部屋は庭を維持。
- 庭は苔とツツジが目印。1階で2秒ごとにハート1個分回復し、敵と新規宝箱を生成しない。
- 宝物庫は金の床飾りと本棚が目印。敵を生成せず、解錠済み宝箱1個にダイヤ3・エメラルド8・金インゴット12・耐久力IIIの本1冊を配置する。
- **再構築で撤去され、新しい宝物庫として生成された部屋には新しい報酬が入る。** 在室保護で残った同じ部屋、再入場、保存復元、宝箱修復では取得済みの中身を補充しない。複数人でも報酬は部屋単位で共有。
- 途中保存から復帰する場合、投入中の報酬は再投入しない（重複防止）。

Gitへの反映であり、XServerへの転送・ワールド再起動は未実施。配布manifestとワールド参照の版は変更していない。Minecraft実機の外観と本の使用確認は未実施。

### 再現できる検証

リポジトリルートから実行する（Node.js、Pythonの `amulet-nbt` / `numpy` が必要）。

```powershell
$castlePack = 'behavior_packs/bp_16_3efecae8-a036-4e14-94d3-876e29fe0ae9'
node "$castlePack/tests/sourceRoomMaterials.test.js"
node --loader "./$castlePack/tests/minecraft-server-encounter-loader.mjs" "$castlePack/tests/sourceHealingGarden.test.js"
node --loader "./$castlePack/tests/minecraft-server-encounter-loader.mjs" "$castlePack/tests/sourceTreasureVault.test.js"
python tools/build_castle_room_materials.py $castlePack
python tools/build_castle_healing_garden.py $castlePack
python tools/build_castle_treasure_vault.py $castlePack
```

128配置の素材・保存・保護継承、回復境界、マルチプレイ、報酬の補充抑制、新世代への報酬付与、旧セーブ移行を検査。
建築生成ツールはNBT差分を照合し、庭・宝物庫の四方向の出入口への通路も検査する。

## 以前の導入記録

ローカルの無限城BP/RPと`infinite_castle_v3`・`infinite_castle_rp_v3`の作業差分を使用。ロジックはPrototype v0.1.41、配布manifestはBP 0.1.42 / RP 0.1.6。UUIDは維持。

`infinite_castle:dungeon`を起動時に登録します。`infinite_castle:entrance_marker`を設置し、その上を通過すると入場します。出口カテゴリの部屋から入場前の場所へ戻ります。

管理者の取得コマンド：

```mcfunction
/give @s infinite_castle:entrance_marker
```

無限城内の診断：

```mcfunction
/scriptevent infinite_castle:debug_build_version
/scriptevent infinite_castle:debug_reconstruction_status
```

配置素材と再構築コードは配布済みですが、プレイヤーによる入場・歩行・再構築中の体感負荷は今回未検証です。ローカルワールドのDB・保存済みの城は移植していません。
