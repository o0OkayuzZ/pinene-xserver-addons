# ピネディメンション：XServer導入版

ローカルの`Pinene PvP Island BP/RP` 0.2.14を基に、manifestを双方0.2.15へ更新。UUIDを維持し、独立したBP/RPとして登録しました。既存ピーネンBP/RPも更新しています。

`pinene_pvp:pvp_island`を起動時に登録し、原点付近に最小の足場と島の核を生成します。ローカルワールドの広大な島・建築・LevelDBデータは移植していません。

管理者の確認用コマンド：

```mcfunction
/scriptevent pinene_pvp:status
/scriptevent pinene_pvp:enter
/scriptevent pinene_pvp:leave
```

`enter`は原点の足場へ移動、`leave`はオーバーワールドの初期スポーンへ戻る開発用動作です。今回、プレイヤーの転送操作は未検証です。

竜の遺物の表示と転送処理はこの独立BPで起動します。既存ピーネンBPの同じ処理を読み込むimport 2行は二重購読を避けるため削除。既存専用BPにあるCD・牛・フィギュア等の定義コピーは配布用ピーネンBPから除外しました。ローカル開発元は変更していません。
