# サーバー側のVibrant Visuals禁止を解除

水が通常描画になり、クライアント側で「鮮やかなビジュアル」へ変更できないとの報告を受けて調査した。

`/opt/minecraft/server/server.properties`では`#disable-client-vibrant-visuals=true`がコメントアウトされ、有効な指定がなかった。公式仕様ではこの項目の既定値は`true`であり、サーバーがクライアントへVibrant Visuals以外のモードを使用するよう通知する。

2026-09-08、該当行だけを次の有効な設定へ変更し、サーバーを再起動した。

```properties
disable-client-vibrant-visuals=false
```

変更前設定は`/opt/minecraft/server/_pinene_deploy_backups/vibrant_20260908_221632/server.properties`に保存。設定の読み戻し、`minecraft-server.service`のactiveと`Server started.`を確認済み。RP・水設定・パック順・UUIDは変更していない。

プレイヤーは再接続後に「鮮やかなビジュアル」を選択して表示を確認する。これは対応端末での利用を許可する設定であり、非対応端末へ強制する設定ではない。クライアントの水面表示は未確認。

サーバー再構築・更新時にも上記の有効な設定を維持すること。リポジトリにはサーバー設定全体を収録していない。

参照：[Microsoft公式サーバー設定](https://learn.microsoft.com/en-us/minecraft/creator/documents/bedrockserver/server-properties?view=minecraft-bedrock-stable)。
