# ピネナイト防具：外観確認用実装

## 外観v0.2.0：上位装備らしい輪郭へ更新

ユーザーの承認に基づき、後方へ伸びる4本の冠、太い節状背骨、背中の3対の突起、厚い肩装甲、かかとの突起を追加・調整しました。胸の開口部は維持しています。旧版との比較と前・後・横のモデル描画は[プレビュー](preview_v0.2.0.png)で確認できます。

ローカルの「ピネナイト外観テスト RP」にも同じモデルを反映済みです。ワールド登録を保つためローカルパックのUUID・manifestバージョン0.1.0は維持し、説明欄に外観v0.2.0を記載しています。Minecraftを保存して終了し、アプリを再起動して読み直してください。アイテムの取得し直しは不要です。

旧版はユーザー提供のゲーム内画像で装着表示を確認できています。今回のv0.2.0はモデル描画・静的検証までで、ゲーム内の追従や干渉は再確認が必要です。

`Pinenite_Visuals_Source_v0.1.0.zip` の4部位を既存パックへ統合。防御値0、耐久設定・特殊能力・耐性・追加HP・エンチャント設定・レシピ・自然入手は追加していません。

## 取得方法

対象のBP/RP更新後、クリエイティブの装備カテゴリから取得するか、プレイヤーとして次を実行します。

```mcfunction
/function pinenite/give_set
```

4点をインベントリに追加します。装備中の防具は置換しません。個別取得も可能です。

```mcfunction
/give @s true_dn:pinenite_helmet
/give @s true_dn:pinenite_chestplate
/give @s true_dn:pinenite_leggings
/give @s true_dn:pinenite_boots
```

サーバーコンソールからは `execute as <プレイヤー名> run function pinenite/give_set` を使用します。

## 統合構造

| 対象 | 統合先・設定 |
| --- | --- |
| item / function | Deathnerite BP `bp_05_90f045c3-0718-4981-a1ff-180976002a93` |
| attachable / geometry / PNG / 表示名 | Parcaniteの3D資産を収録するDungeons RP `rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b` |
| ID | `true_dn:pinenite_helmet` / `chestplate` / `leggings` / `boots`（各末尾に同じ接頭辞） |
| アイコン | `textures/items/pinenite_<部位>.png`、32×32 RGBA、正面向き、背景透過 |
| 頭 | `head`、支点 `[0,24,0]` |
| 胸 | 肋骨・背骨・背面突起78キューブを`body`に保持。左右の肩・前腕各11キューブは`leftArm` / `rightArm`、親は`body` |
| 腰・脚 | 腰は`body`、左右脚は`leftLeg` / `rightLeg` |
| 足 | 左右それぞれの`leftLeg` / `rightLeg` |
| 描画 | 独立した`controller.render.true_dn.pinenite_armor`と`entity_alphatest` |
| 一人称 | 元素材の設定を維持し、カスタム防具の全boneを非表示。腕の防具も表示しない |
| 明るいシアン部分 | 元テクスチャのハイライト。実際の発光・光源・ブルームは未実装 |

モデルは205キューブ（頭54・胸100・脚27・足24）。geometryとBlockbenchを同時に更新し、bone階層・支点を維持しています。追加形状には既存のUVタイルを再利用しています。8枚のPNGはZIP内の対応素材とバイト単位で一致し、基本色と元の正面アイコンを維持しています。胸前面の肋骨を厚くしつつ、隙間を残しています。

既存Parcaniteと同じbone名・座標系でプレイヤーの姿勢を受ける構造です。腕の独自アニメーションやplayer.entity.jsonの上書きは追加していません。元ZIPの独立BP/RP・UUID・インストール用mcaddonは組み込んでいません。

## バージョンと適用

| パック | 変更前 | 変更後 |
| --- | --- | --- |
| Deathnerite BP | 2.12.16 | 2.12.18 |
| Dungeons RP | 1.5.16 | 1.5.21 |
| Dungeons BP | 1.5.17 | 1.5.22 |

Dungeons BPはRP依存バージョンの同期のためにmanifestだけを更新しています。UUID・パック順序を維持し、既存の相互依存とルート／`worlds/Bedrock level/`の登録4ファイルを同期済みです。元のサーバースナップショットを表す`snapshot-files.json`は更新していません。

2026-09-08にボス報酬修正・Waystone・INAKA修正と合わせてXServerへ反映し、起動を確認しました。[適用記録](../deployments/2026-09-08-addon-refresh.md)を参照してください。装備の実機表示と更新済みRPのクライアント受信は未確認です。`validation_report.json`は静的検証時点の記録であり、サーバー適用の記録は上記文書に分けています。

## 検証結果と未確認事項

`validation_report.json`に実行結果を保存しています。検証スクリプトはPythonとPillowを使用します。

```text
python tools/validate_pinenite.py
```

静的検証で、4部位のID・スロット・アイコン参照・装着テクスチャ参照・UV範囲・bone親子関係・支点・Blockbenchとの一致・日本語／英語名・既存atlas保持・パック登録を確認しました。元ZIPのSHA-256一覧と8枚のPNGの一致も確認済みです。v0.2.0のモデル形状は承認されたデザイン変更を含みます。既存装備・スクリプト・共通描画ファイルには差分がありません。

| 要求された確認 | 結果 |
| --- | --- |
| 4アイコン | PNG寸法・透過・参照を静的検証済み。提供プレビューの正面向きを目視確認。ゲーム内表示は未確認 |
| 装備スロット | head / chest / legs / feetの定義を検証済み。実際の装備操作は未確認 |
| 一人称・三人称 | 専用controllerの参照と一人称非表示条件を検証済み。実機エラー有無は未確認 |
| 歩行時の脚追従 | 左右脚bone・支点を検証済み。実機での追従は未確認 |
| 腕振りと胸形状 | 胸本体をbodyに保持し、腕パーツを分離していることを確認。動作中の貫通・破綻は未確認 |
| 頭の向き | head bone・支点を検証済み。実機追従は未確認 |
| ピンク黒テクスチャ | 欠落参照・画像破損・UV範囲外なし。実機描画は未確認 |
| Content Log | XServer再起動後の新規Content Logは空。クライアント側は未確認 |
| 既存装備 | 定義・PNG・共通描画・スクリプトは未変更。実機での回帰確認は未実施 |

実機では1部位ずつ→全4部位の順に装備し、前後左右、インベントリの人物表示、視点切替、歩行、スニーク、腕振り、頭回転を確認してください。通常／スリムスキン、水泳、エリトラ併用、手に持った場合も確認対象です。モデルの適合・追従を実機で確認するまでは、本番動作確認済みとは扱わないでください。

## 今後の調整箇所

- `blockbench/pinenite_*.bbmodel`：テクスチャ埋め込み済みの編集用データ。出力時の識別子は`true_dn.pinenite_*`に統一済み。変更後はRPのgeo.jsonとPNGへ書き出す必要があります。
- RPの`models/entity/pinenite/*.geo.json`：ゲームが実際に読み込む形状・UV・bone支点。肋骨・背骨はbody、肩・前腕はarm、脚・足は対応legを維持してください。
- RPの`textures/models/armor/pinenite_*.png`：装着時の色と濃淡。同じUVタイルを複数面で共有しているため、編集は複数箇所へ反映されます。
- RPの`textures/items/pinenite_*.png`：部位別の透過アイコン。
- RPの`render_controllers/pinenite.render_controllers.json`：一人称表示方針の変更箇所。
- `design/cube_labels.json`と`design/palette.json`：元素材の部位ラベル・パレット。

仕様確認に使用した公式資料：[Attachables](https://learn.microsoft.com/en-us/minecraft/creator/documents/attachables?view=minecraft-bedrock-stable)、[Wearable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_wearable?view=minecraft-bedrock-stable)、[Molang query functions](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/molangreference/examples/molangconcepts/queryfunctions?view=minecraft-bedrock-stable)。

## 追加・変更ファイル一覧

以下の一覧はリポジトリルートからの相対パスです。

- `README.md`
- `behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/functions/pinenite/give_set.mcfunction`
- `behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/items/Deathnerite-Add-On/pinenite/armor/pinenite_boots.json`
- `behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/items/Deathnerite-Add-On/pinenite/armor/pinenite_chestplate.json`
- `behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/items/Deathnerite-Add-On/pinenite/armor/pinenite_helmet.json`
- `behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/items/Deathnerite-Add-On/pinenite/armor/pinenite_leggings.json`
- `behavior_packs/bp_05_90f045c3-0718-4981-a1ff-180976002a93/manifest.json`
- `behavior_packs/bp_08_2c5e0de8-0360-49ac-bfe5-339a2a0e62f2/manifest.json`
- `docs/pinenite/README.md`
- `docs/pinenite/blockbench/pinenite_boots.bbmodel`
- `docs/pinenite/blockbench/pinenite_chestplate.bbmodel`
- `docs/pinenite/blockbench/pinenite_helmet.bbmodel`
- `docs/pinenite/blockbench/pinenite_leggings.bbmodel`
- `docs/pinenite/design/cube_labels.json`
- `docs/pinenite/design/palette.json`
- `docs/pinenite/preview_v0.2.0.png`
- `docs/pinenite/source.json`
- `docs/pinenite/validation_report.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/attachables/deathnerite/pinenite/pinenite_boots.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/attachables/deathnerite/pinenite/pinenite_chestplate.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/attachables/deathnerite/pinenite/pinenite_helmet.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/attachables/deathnerite/pinenite/pinenite_leggings.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/manifest.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/models/entity/pinenite/boots.geo.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/models/entity/pinenite/chestplate.geo.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/models/entity/pinenite/helmet.geo.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/models/entity/pinenite/leggings.geo.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/render_controllers/pinenite.render_controllers.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/texts/en_US.lang`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/texts/ja_JP.lang`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/item_texture.json`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/items/pinenite_boots.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/items/pinenite_chestplate.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/items/pinenite_helmet.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/items/pinenite_leggings.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/models/armor/pinenite_boots.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/models/armor/pinenite_chestplate.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/models/armor/pinenite_helmet.png`
- `resource_packs/rp_06_ab296f68-bb16-4ede-a49c-d0ed99b5b87b/textures/models/armor/pinenite_leggings.png`
- `tools/validate_pinenite.py`
- `world_behavior_packs.json`
- `world_resource_packs.json`
- `worlds/Bedrock level/world_behavior_packs.json`
- `worlds/Bedrock level/world_resource_packs.json`
