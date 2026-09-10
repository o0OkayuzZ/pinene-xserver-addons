# Mycology システムv1.3・画像v1.4

システムはv1.3、キノコ画像はv1.4の更新ZIPを正として統合しました。既存ID・texture key・決定済みシステム仕様を維持しています。現在のGit・配備状態は[統合報告](../deployments/2026-09-10-foods-mycology.md)を参照してください。

## 画像と再生成

R01〜R15、B01〜B20の35画像を、以下の3か所でv1.4に同期しました。R13とB16〜B20もv1.4同梱版です。

- 実装RP: `resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/textures/items/mycology/`
- authoring RP: `tools/mycology/pack/RP/textures/items/mycology/`
- 再生成原本: `tools/mycology/reference/final_32x32/`

全35画像は32×32 RGBAで、同梱[asset_manifest.json](../../tools/mycology/docs/texture_v1.4/asset_manifest.json)のSHA-256と一致します。[画像更新指示](../../tools/mycology/docs/texture_v1.4/CODEX_TEXTURE_UPDATE.md)も保存しています。

`build_items.py` は検証済み原本をそのままコピーします。`build_assets.py` と `build_pack.py` から呼ばれ、旧キノコを描画する生成処理は削除しました。原本が欠損・破損していれば中断し、旧画像へフォールバックしません。

隔離コピーで `build_assets.py → build_pack.py → build_assets.py` を実行し、35画像がv1.4のままであることを確認しました。R13原本の欠損・破損では出力を変更せず中断することも確認済みです。最新の図鑑追加後の再ビルド結果は[こちら](../deployments/evidence/2026-09-10/rebuild_verification.json)。

## 実機確認

Minecraft for Windows v26.45の隔離テストワールドで確認しました。

| 項目 | 結果 |
|---|---|
| 35種のインベントリ表示 | [確認済み](evidence/v1.4/inventory-35.png) |
| R13の手持ち | [確認済み](evidence/v1.4/held-r13.png) |
| R13のドロップ | [確認済み](evidence/v1.4/drop-r13.png) |
| 図鑑のB16〜B20 | [B16](evidence/v1.4/book-b16.png)、[B17〜B20](evidence/v1.4/book-b17-b20.png)で確認済み |

全35種それぞれの手持ち・ドロップ形態、複数端末、モバイルでの表示は未確認です。既存パック由来の描画警告の全解消を保証するものではありません。

旧画像更新時の[変更ファイル一覧](TEXTURE_v1.4_CHANGED_FILES.txt)、[再ビルド記録](texture-v1.4-rebuild.json)、[保全照合](texture-v1.4-preservation.json)は履歴資料です。携帯図鑑と金食料・パンケーキを含む最新変更は統合報告を参照してください。
