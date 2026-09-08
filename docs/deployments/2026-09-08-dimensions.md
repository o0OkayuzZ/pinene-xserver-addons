# 無限城・ピネディメンション導入：2026-09-08

ユーザー承認により、無限城とPinene PvP Islandを独立パックとして追加し、ローカルのピーネンBP/RP更新を反映。現在17 BP / 20 RP。UUIDと既存パックの相対順を維持し、新規登録は末尾へ追加した。

| パック | 最終version |
| --- | --- |
| ピーネン BP / RP | 1.0.63 / 1.0.54 |
| 無限城 BP / RP | 0.1.42 / 0.1.6 |
| Pinene PvP Island BP / RP | 0.2.15 / 0.2.15 |
| ゾンビ装備 BP / 対応RP | 1.0.8 / 1.0.14 |

ゾンビ装備の更新は既存依存versionの連鎖同期のみ。ボス報酬・ピネナイト・Waystone・INAKAの前回修正は維持。

## 適用と検証

- 全10,193ファイルのSHA-256と、ルート／実ワールドの登録4ファイルを照合。
- 配布対象のJSON 339件、JavaScript 69ファイルの構文、相対import、全37パックのUUID・依存・version整合性を確認。
- 無限城の既存JSテスト6件成功。配置テストは旧期待値schema 5を実装のschema 6に合わせた検証用コピーで、2スタイル×100シード成功。ゲームロジックをテスト合わせで変更していない。
- 最初の起動で両ディメンションを指定した`execute in ... run list`が成功。サーバー1.26.45.1で認識されることを確認。
- 起動ログでローカルBP由来の重複定義警告を確認したため、今回追加したコピー96ファイルを取り除き、versionを上げて再適用。更新前から存在するファイルは削除していない。
- プレイヤーの入場・装着・戦闘・城の再構築は未検証。

バックアップは各停止時にワールド全体と変更前ファイルを保存：

- 導入前：`/opt/minecraft/server/_pinene_deploy_backups/20260908_220000`
- 重複除去前：`/opt/minecraft/server/_pinene_deploy_backups/20260908_220433`

## 容量の訂正

最初の約21 MBの見積もりは、独立したPinene PvP Island本体を含めていなかった。本体と必要なクライアントentity、既存資産の保持を含む最終的な増加量は**50.21 MB**（50,208,610 bytes、展開後）。ワールドDB・バックアップ・通信量は別。

設定とパック資産のみを導入し、ローカルの地形データは移植していない。ピネディメンションは最小足場から始まる。

操作方法：[無限城](../dimensions/infinite-castle.md)、[ピネディメンション](../dimensions/pinene-pvp-island.md)。

API確認資料：[Microsoft公式1.26.40更新](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/Documents/Update1.26.40.md)、[カスタムディメンション登録](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/ScriptAPI/minecraft/server/DimensionRegistry.md)。最終的な互換性は上記実サーバーのコマンド結果でも確認した。
