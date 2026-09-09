# 指定JPGへの生地差し替えとインベントリ表示調整

- 入力: C:/Users/はーにゃ。/Downloads/pancakekizi (1).jpg
- 最終生地: [pancake_batter.png](C:/Users/はーにゃ。/AppData/Roaming/Minecraft Bedrock/Users/Shared/games/com.mojang/development_resource_packs/ピーネン実験導入3/textures/items/pancake_batter.png)
- 内蔵image_genでJPGに焼き込まれた市松背景を透過化。元の箱・生地・視点を保持。CLI未使用。
- 全4アイテムは256×256の正方形透過PNG。実物の縦横比を保ち、長辺224px（キャンバスの87.5%）で中央に配置。正方形の欄でも絵の縦横比は維持される。
- 絵の占有寸法: 通常224×199、はちみつ224×200、ベリー224×207、生地224×183。
- 完成品3枚は既に基準を満たしていたため、再加工せず検証。
- [インベントリ風プレビュー](inventory_preview.png) はローカルで作成した比較用の模擬表示。実際のMinecraft画面ではない。
- 4枚の寸法・中央配置・透過外周・アトラス参照、およびBP/RP依存バージョンを検証済み。ゲーム内の実表示は未確認。
- BP 1.0.64 / RP 1.0.56。ローカル開発パックへ反映。
- バックアップ: _workspace/backups/pancake_batter_jpg_20260909_135512/

内蔵image_genの最終プロンプト:

```text
Use case: background-extraction. Edit this specific supplied JPG into a Minecraft inventory item icon. Preserve EXACTLY the original square wooden tray with tall tan sides and dark brown lower sides, the yellow raw pancake batter with small brown and pale speckles, its isometric perspective, original proportions, colors, and blocky pixel-art style. Do NOT substitute a shallow bowl or a different tray. Remove the entire gray/white checkerboard background (it is baked into this JPG, not transparency). Background must be genuine transparent alpha, no checkerboard, no white border, no shadow, no detached noise pixels. Keep the entire object intact, crisp clean edges. Center the isolated complete tray on a square transparent canvas with balanced small margins. No extra elements or text. This will be resized for a Minecraft inventory slot.
```

