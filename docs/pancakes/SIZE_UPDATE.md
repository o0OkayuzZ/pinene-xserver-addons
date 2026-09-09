# 画像サイズ調整

- 対象: RP textures/items/ の pancake.png、honey_pancake.png、berry_honey_pancake.png、pancake_batter.png。
- 4枚すべて256×256、絵の長辺224px、中央配置。縦横比とアルファを保持し最近傍補間。
- 完成品の絵: 通常224×199、はちみつ224×200、ベリー224×207。生地224×151。
- 生地の旧16×16画像に残っていた白い背景は内蔵image_genで透過化。その後、他3枚と共通のサイズへ整えた。
- BP 1.0.63 / RP 1.0.55。ローカル開発パックへ保存済み。
- 4枚の寸法・外周透過・manifest依存の一致を確認、4枚とも目視確認。ゲーム内表示は未確認。
- 変更前の画像とmanifest: _workspace/backups/pancake_sizes_20260909_135129/

生地の編集プロンプト（内蔵image_gen、CLI未使用）:

```text
Use case: background-extraction. Edit target is the provided 16x16 Minecraft pancake batter item icon, a small shallow tan wooden tray containing pale cream raw batter viewed diagonally from above. Preserve the original low-resolution pixel-art silhouette, palette and perspective exactly. Remove the white background around the tray; use genuine transparent alpha outside the tray, with zero speckles, no checkerboard or painted background. Do not remove the cream batter inside the tray. Enlarge using crisp nearest-neighbor style pixels, not smoothing or adding detail. Deliver one square PNG 256x256 with the complete tray centered, longest subject dimension 224px, 16px margin either side of the longest axis. No text, extra items or shadows.
```
