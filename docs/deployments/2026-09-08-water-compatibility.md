# 描画優先向けの水面とVibrant Visuals選択の調査

サーバーの`disable-client-vibrant-visuals=false`は維持されていた。クライアントの保存済み`options.txt`では`graphics_mode_switch:0`で、ゲーム内モード切り替えが無効。タイトル画面でも選択できないかは未確認。サーバー側の禁止解除だけで選択問題が解決したとは断定しない。

## 描画RP 1.3.21

既存描画RPの水面には、同じbasenameで模様入りPNGと単色TGAが同居している。描画優先向けの参照を明確にするため、既存PNGをバイト単位で複製した`textures/blocks/pinene_water_still.png`へ、`still_water_grey`のatlasとflipbook参照だけを変更した。

新しいtexture setは既存の`water_still_grey.texture_set.json`と同じ内容で、PBRのcolor参照は元の`water_still_grey`を維持する。水の流れ・水色・波・反射のパラメーターは変更していない。描画優先では通常のテクスチャアニメーションを使用し、Vibrant Visualsの反射・屈折は再現しない。

`min_engine_version`を公式Vibrant Visuals RP要件の1.21.120へ更新。header/module versionは1.3.21、ルートと実ワールドのRP登録を同期。UUID・パック順・サブパックを維持。

PNGのRGBA・16×512（32フレーム）・透過・輝度変化・元画像とのバイト一致、TGA同名衝突がないこと、JSONとPBR参照を静的検証した。プレイヤーの水面表示とモード選択は実機確認が必要。

22:19のstopコマンドによる停止を検出したため、ユーザーに起動意図を確認し、「修正後に起動してよい」との指示で適用・起動する。

参照：[Vibrant Visuals RP要件](https://learn.microsoft.com/en-us/minecraft/creator/documents/vibrantvisuals/vvresourcepacks?view=minecraft-bedrock-stable)、[Texture Sets](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/texturesetsreference/texturesetsconcepts/texturesetsintroduction?view=minecraft-bedrock-stable)。
