# 金食料 v0.1.1 実装・検証報告

作業先: C:/Users/はーにゃ。/Downloads/pinene-golden-foods-v011
ブランチ: codex/golden-foods-v011-20260909、基準HEAD: cb19e50。
既存pinene-gf-worktreeの別作業の未コミット変更は変更していません。
専用Git作業ツリーで実装済み。mainへのpush、本番配布、再起動、実機試験は行っていません。
この会話のパンケーキ開発パックへも金食料の重複コピーは行っていません。

## 調査・矛盾の解決

- 添付ZIPは仕様・設計JSONであり、PNGや完成アドオンではありません。
- D16・追加確定ルールを優先し、a:egwheat×3→a:egbreadは残しました。古い「廃止」の文とA07の「無効」は採用していません。
- 既存小麦・パン各IDはbp_02に1件ずつ。bp_15の重複小麦レシピ2件を削除し、bp_02を正規所有者にしました。
- 対象HEADにエンチャント金リンゴレシピはありませんでした。会話のローカル開発パックには共通経路が存在したので、同じID myname:enchanted_golden_appleと同じ内容を取り込みました。対象ツリー内の同一経路は1件です。
- 金パイは完成パイ＋金インゴット8を維持。パンの正規エンチャント経路と割高な小麦経路は共存。
- 既存小麦は牛の誘導・給餌、パンはloot等の参照があります。4IDは維持し、牛・loot・取引・装備コードは変更していません。
- 供給元の参照一覧は [audit.json](audit.json) のsuppliesに記録。

## エンジン・API・パック

- 手元のインストールはMicrosoft.MinecraftUWP 1.26.4501.0。稼働Xserverの実エンジン版・現在の有効順序・RPキャッシュは未確認です。
- 有効BP/RPの調査基準はリポジトリのworld登録ファイル。番号から優先順位を推測していません。
- bp_02にScript module追加。@minecraft/server 2.0.0、@minecraft/server-ui 2.0.0、min_engine_version 1.21.90。
- npm配布のAPI 2.0.0の型定義でstartup/onConsume/onUse/getEffect/addEffect/removeEffect等の存在を確認。
- bp_02/rp_05/bp_15の変更に加え、既存の実依存を持つbp_09/rp_07のmanifestと登録を同期しました。装備本体は変更していません。
- バージョン一覧: [versions.json](versions.json)。root/worldの登録・モジュール・依存は静的検証済み。

## 実装済み

- 新規食料・食材11種類、既存小麦・パン4種類、任意閲覧用図鑑1種類。
- 食料17レシピ＋図鑑レシピ。生ジャガイモ→金→焼成→エンチャント化。
- 食事完了のonConsumeから共通処理を1回。旧food.effectsとuse_durationは対象アイテムから除去。
- 重ね食い可能。強度加算、時間加算、共通クールダウン、料理排他なし。
- 強い既存効果を弱めず、同レベルでは長い残時間を優先。強い食料バフに弱い効果の長時間を合成しません。
- 強い既存効果により見送った弱い食料バフを、あとから独自再付与することはしません。外部ソースの完全追跡を仮定しない保守的な挙動です。
- 図鑑ID pinene:golden_food_guide。本1＋金塊1で作り、使用すると15カスタム項目を閲覧できます。
- 食事中のチャット/アクションバー/フォーム表示なし。図鑑の時間・レベルは実行データから生成し、分類タグは出しません。
- 食品ごとの周期スキャンは0。ログアウト・死亡・再起動時に効果時間を復活させる独自永続状態は持ちません。

## 採用ID・試験用数値

添付仕様の試験候補値を採用。最終バランス確定ではありません。

| 名前 | ID | 栄養/係数 | 有効な基本バフ |
|---|---|---|---|
| エンチャントされた金のニンジン | pinene:enchanted_golden_carrot | 6/1.2 | 暗視レベル1（480秒） |
| 金のジャガイモ | pinene:golden_potato | 1/0.3 | なし |
| ベイクド金ジャガイモ | pinene:baked_golden_potato | 10/1.0 | 採掘速度レベル1（180秒）・移動速度レベル1（180秒） |
| エンチャントされたベイクド金ジャガイモ | pinene:enchanted_baked_golden_potato | 20/1.0 | 採掘速度レベル2（300秒）・移動速度レベル1（300秒） |
| 金のビートルート | pinene:golden_beetroot | 6/1.0 | 移動速度レベル1（120秒）・採掘速度レベル1（120秒）・再生レベル1（10秒） |
| エンチャントされた金のビートルート | pinene:enchanted_golden_beetroot | 12/1.0 | 移動速度レベル2（240秒）・採掘速度レベル2（240秒）・再生レベル1（240秒） |
| エンチャントされたきらめくスイカの薄切り | pinene:enchanted_glistering_melon_slice | 12/1.0 | 火炎耐性レベル1（300秒）・移動速度レベル1（300秒） |
| 金のパンプキンパイ | pinene:golden_pumpkin_pie | 12/1.0 | 耐性レベル1（120秒）・再生レベル2（10秒）・衝撃吸収レベル2（120秒） |
| エンチャントされた金のパンプキンパイ | pinene:enchanted_golden_pumpkin_pie | 20/1.0 | 耐性レベル2（300秒）・衝撃吸収レベル4（180秒）・再生レベル2（30秒） |
| 金の毒ジャガイモ | pinene:golden_poisonous_potato | 4/0.6 | 衝撃吸収レベル1（120秒） |
| エンチャントされた金の毒ジャガイモ | pinene:enchanted_golden_poisonous_potato | 8/1.0 | なし |
| 金の小麦 | a:gwheat | 非可食 | なし |
| エンチャントされた金の小麦 | a:egwheat | 非可食 | なし |
| 金のパン | a:gbread | 10/1.0 | 再生レベル2（15秒）・移動速度レベル1（90秒）・採掘速度レベル1（90秒） |
| エンチャントされた金のパン | a:egbread | 20/1.0 | 再生レベル2（30秒）・移動速度レベル2（180秒）・採掘速度レベル2（180秒） |

食事時間1.6秒。完成食料は満腹時可、生の金ジャガイモは満腹時不可。小麦2種は非可食。
旧金パンは栄養6/係数1、再生I6秒・吸収I150秒でした。新設定では栄養10/係数1、再生II15秒・速度I90秒・採掘I90秒。その他の変更前値は基準HEADに保存されています。

## レシピ一覧

| 結果 | 材料/工程 | 出力 |
|---|---|---|
| minecraft:enchanted_golden_apple | minecraft:golden_apple×1＋minecraft:gold_block×8 | 1 |
| pinene:enchanted_golden_carrot | minecraft:golden_carrot×1＋minecraft:gold_block×8 | 1 |
| pinene:golden_potato | minecraft:potato×1＋minecraft:gold_ingot×8 | 1 |
| pinene:baked_golden_potato | pinene:golden_potato×1 → 焼成 | 1 |
| pinene:enchanted_baked_golden_potato | pinene:baked_golden_potato×1＋minecraft:gold_block×8 | 1 |
| pinene:golden_beetroot | minecraft:beetroot×1＋minecraft:gold_ingot×8 | 1 |
| pinene:enchanted_golden_beetroot | pinene:golden_beetroot×1＋minecraft:gold_block×8 | 1 |
| pinene:golden_pumpkin_pie | minecraft:pumpkin_pie×1＋minecraft:gold_ingot×8 | 1 |
| pinene:enchanted_golden_pumpkin_pie | pinene:golden_pumpkin_pie×1＋minecraft:gold_block×8 | 1 |
| pinene:golden_poisonous_potato | minecraft:poisonous_potato×1＋minecraft:gold_ingot×8 | 1 |
| pinene:enchanted_golden_poisonous_potato | pinene:golden_poisonous_potato×1＋minecraft:gold_block×8 | 1 |
| a:gwheat | minecraft:wheat×1＋minecraft:gold_ingot×8 | 1 |
| a:egwheat | a:gwheat×1＋minecraft:gold_block×8 | 1 |
| pinene:enchanted_glistering_melon_slice | minecraft:glistering_melon_slice×1＋minecraft:gold_block×8 | 1 |
| a:gbread | a:gwheat×3 | 1 |
| a:egbread | a:gbread×1＋minecraft:gold_block×8 | 1 |
| a:egbread | a:egwheat×3 | 1 |

旧金小麦の金塊4＋インゴット4はインゴット8へ。エンチャント金小麦の中央は金小麦へ統一。
パンの空行入りパターンは横一列AAAへ正規化。代替経路も残しています。
かまど・燻製器・焚き火・魂の焚き火のタグを設定。各機器の実機動作は未確認。溶鉱炉のタグなし。

## 画像

- Minecraft本体のバニラRPから、各素材が存在する最も新しいバージョンのオーバーレイを採用。所在・SHA256・版は [texture_provenance.json](texture_provenance.json)。サーバー画像との一致は未確認。
- 全て16×16、元の透明画素・輪郭を維持。リンゴ→金リンゴの同位置画素から金パレットを抽出し、明暗順を対応付けました。
- 毒ジャガの既存の緑や葉の緑領域は保持。勝手なドクロ・宝石・白金の縁取りは追加していません。
- 金/エンチャントは同じユニークなアトラスキー・PNGを参照し、表示名とglintだけが異なります。古い他用途の画像は削除していません。
- [比較画像](texture_comparison.png) の左から元／金／エンチャント用の同じ基礎画像。第3列はglintを描いていません。実機glint表示は未確認。

## 条件付き・保留

実機検証ゲートがある能力は有効化せず、図鑑の能力欄から除外しています。

| 機能 | 現状 | 必要な検証 |
|---|---|---|
| 食後デバフ解除 | アダプター・単体テストあり、無効 | 対象ID、装備との共存 |
| 食後消火 | アダプターあり、無効 | 火/溶岩との実挙動 |
| 既存毒/衰弱/空腹25%短縮 | アダプター・単体テストあり、無効 | 1回限り、無期限、再付与、装備 |
| 盲目/暗闇/毒の完全阻止 | 未実装・無効 | 付与前キャンセルAPIと共存 |
| 新規デバフ付与時間短縮 | 未実装・無効 | duration更新、再帰防止 |
| 消耗の割合軽減 | 未実装・無効 | 属性周回、消耗由来、食事/自然回復/装備 |
| 既存きらめくスイカの可食化 | 保留、既存用途維持 | 同ID・醸造・取引・消費・中断・満腹・複数端末 |
| 予備エネルギー・熱接触再生・毒の回復変換 | Phase2、未実装 | 永続化・間隔・濫用対策 |
| 毒強度連動吸収・敵輪郭・追加ダッシュ/水中補正 | 保留、未実装 | 仕様・API確認 |

## 試験結果

- [静的検査結果](static_validation.json): JSON重複キー、対象schema構成、15IDの単一定義、17レシピの単一経路、不正調理省略、画像共有・alpha一致、依存と登録、loot/装備コード不変を検証。
- [単体テスト](runtime_tests.txt): 16件成功。APIを模擬したテストであり実機検証ではありません。
- 完全なエンジンschema検証とcontent log検証は未実施。
- A01〜A26の実機試験は全て未実施。装備・自然回復OFF・マルチ・手持ち/ドロップ/暗所/glint・RPキャッシュは本番前に確認が必要です。
- 周期的全プレイヤースキャンは0。実機負荷測定は未実施。

## バランス課題

- ビートとパンの速度II/採掘IIが重複。ビート再生I240秒は強い候補値。
- パンの金コスト96相当と他系列80相当。小麦代替経路は240相当で追加特典なし。
- 焼きジャガイモの採掘II300秒に対しパン180秒。消耗軽減が無効の段階では完成形の専門性を比較できません。
- 金パイは8インゴットのまま強い防御性能。黙って数値を弱めていません。
- スイカの火炎耐性300秒だけで金リンゴより優位とは判断していません。対象版のバニラ標準値は実測していません。
- 牛/取引/ダンジョン供給と多種重ね食いは実地比較が必要。

## 技術資料

- [Microsoft Custom Components V2](https://learn.microsoft.com/en-us/minecraft/creator/documents/scripting/components-tutorial?view=minecraft-bedrock-stable)
- [Microsoft ItemCustomComponent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/itemcustomcomponent?view=minecraft-bedrock-stable)
- [Microsoft Food](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_food?view=minecraft-bedrock-stable)
- [Microsoft Entity](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity?view=minecraft-bedrock-stable)
科学文章の出典・ユーザー指定文はinputの原仕様書に保存しています。

## 確認用ZIP

変更ファイルだけを収録した差分で、単体のmcaddonではありません。
削除対象2件はZIPのDELETE_FILES.txtに記載。自動配布機能はありません。
[変更ファイル一覧](CHANGED_FILES.txt)。

[変更前の4アイテム・4レシピの全設定](baseline_items_recipes.json)
