# 無限城：XServer導入版

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
