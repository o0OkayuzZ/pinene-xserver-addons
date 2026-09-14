# VISUAL / ASSET REQUIREMENTS

## Source of truth

`references/ACCEPTED_ZOMBIE_GEAR_REFERENCE.png`

この画像が最終採用デザイン。
以前の旧ゾンビ装備画像、過去生成した金属鎧・蔓・筋肉鎧等の案より優先する。

## Item icons

20個:
- 4 parts × C0〜C4
- exact 32×32 px
- PNG RGBA / transparent
- Minecraft vanilla inventory iconに混ぜても違和感の少ないpixel art
- **全て正面向き**
- Cごとにポーズや角度を変えず、腐敗表現だけ進行させる
- 画像シートをそのまま縮小cropするのではなく、32×32用にpixel-perfectで再構成する

### Chestplate eye
- チェストプレートだけに目玉
- 全C0〜C4に存在
- **プレイヤー左肩**
- 正面画像では **viewer-right**
- 他3部位には目玉を追加しない
- mirrorしない

## Worn 3D models

既存のZombie Gear v4 HDの20 attachable / geometry構成を活用してよい。
ただし見た目をreferenceのC0〜C4へ合わせる。

各part × stageで:
- Helmet C0〜C4
- Chestplate C0〜C4
- Leggings C0〜C4
- Boots C0〜C4

要件:
- Minecraftプレイヤー体型に自然に装着
- バニラ装備の体積感から逸脱しすぎない
- C0→C4の色・欠損/腐敗表現がitem iconと一致
- chestplateの目はplayer-left shoulder
- front / side / backで破綻しない
- 他プレイヤーから見える
- enchant glint対応
- first-personで既存設計が非表示ならその仕様を壊さない
- UVの滲みや透明縁を避ける
- referenceはコンセプトなので、実際のgeometryはMinecraftのbone/pivotに正しく追従させる

## Existing RP areas to inspect

- `resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10/attachables/`
- `.../models/entity/zombiegear_v4hd/`
- `.../textures/merged_equipment/`
- `.../textures/item_texture.json`
- `.../render_controllers/zombiegear_v4hd.render_controllers.json`

Runtime IDsとatlas keyは可能な限り既存を維持。
