"""Create a local review artifact only; does not deploy."""
import json, subprocess, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DOC=ROOT/"docs/golden_foods"
def read(p):return json.loads(p.read_text(encoding="utf-8-sig"))
def git(*args):return subprocess.check_output(["git","-c","core.safecrlf=false",*args],cwd=ROOT).decode("utf8")
def save(p,s):p.write_text(s,encoding="utf8",newline="\n")
seed=read(DOC/"input/balance_seed.json")
baseline={}
for name in ("gwheat", "egwheat", "gbread", "egbread"):
    for folder in ("items", "recipes"):
        path="behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/"+folder+"/"+name+".json"
        baseline[path]=json.loads(git("show", "cb19e50:"+path).lstrip("\ufeff"))
save(DOC/"baseline_items_recipes.json",json.dumps(baseline,ensure_ascii=False,indent=2)+"\n")
custom=[x for x in seed["items"] if not x["item_id"].startswith("minecraft:")]
effects={"night_vision":"暗視","haste":"採掘速度","speed":"移動速度","regeneration":"再生","resistance":"耐性","absorption":"衝撃吸収","fire_resistance":"火炎耐性"}
lines="""# 金食料 v0.1.1 実装・検証報告

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
""".splitlines()
for item in custom:
    food=item["food"];nutrition=f'{food["nutrition"]}/{food["saturation_modifier"]}' if food else "非可食"
    buffs="・".join(f'{effects[e["effect"]]}レベル{e["level"]}（{e["duration_s"]}秒）' for e in item["effects"]) or "なし"
    lines.append(f'| {item["name_ja"]} | {item["item_id"]} | {nutrition} | {buffs} |')
lines += ["","食事時間1.6秒。完成食料は満腹時可、生の金ジャガイモは満腹時不可。小麦2種は非可食。",
"旧金パンは栄養6/係数1、再生I6秒・吸収I150秒でした。新設定では栄養10/係数1、再生II15秒・速度I90秒・採掘I90秒。その他の変更前値は基準HEADに保存されています。",
"","## レシピ一覧","","| 結果 | 材料/工程 | 出力 |","|---|---|---|"]
for recipe in seed["recipes"]:
    materials="＋".join(v["item_id"]+"×"+str(v["count"]) for v in recipe["inputs"].values())
    if recipe["type"]=="furnace":materials+=" → 焼成"
    lines.append(f'| {recipe["output"]["item_id"]} | {materials} | {recipe["output"]["count"]} |')
lines += """
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
""".splitlines()
lines += ["", "[変更前の4アイテム・4レシピの全設定](baseline_items_recipes.json)"]
save(DOC/"IMPLEMENTATION_REPORT.md","\n".join(lines)+"\n")
changed=set(git("diff","--name-only","-z").split("\0"))|set(git("ls-files","--others","--exclude-standard","-z").split("\0"))
changed={p for p in changed if p and "__pycache__" not in p and "/api/" not in p}
changed.add("docs/golden_foods/CHANGED_FILES.txt")
save(DOC/"CHANGED_FILES.txt","\n".join(sorted(changed))+"\n")
deleted=git("diff","--diff-filter=D","--name-only","-z").strip("\0").split("\0")
artifact=ROOT.parent/"golden_foods_v011_review.zip"
with zipfile.ZipFile(artifact,"w",zipfile.ZIP_DEFLATED) as z:
    for p in sorted(changed):
        file=ROOT/p
        if file.is_file():z.write(file,p)
    z.writestr("DELETE_FILES.txt","\n".join(deleted)+"\n")
    z.writestr("REVIEW_ONLY.txt","Review patch for local testing, base cb19e50. Not deployed. See docs/golden_foods/IMPLEMENTATION_REPORT.md.\n")
print(artifact, artifact.stat().st_size,"bytes;",len(changed),"changed/deleted paths")
