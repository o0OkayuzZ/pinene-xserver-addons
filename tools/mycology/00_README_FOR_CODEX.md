# Pinene Mycology — Codex handoff v1.2.0-handoff

**35種のキノコ＋鑑定士NPCの実装候補一式。コンセプト画像だけのパックではありません。**
更新日：2026-09-10。Bedrockエンジンでの実機テストは未実施。本番配備前の検証が必要です。

## 最初に読む順番

1. `FINAL_CODEX_PROMPT.md` — 最終作業依頼（優先）。
2. `CODEX_PROMPT.md` — 旧詳細指示（補助）。
3. `docs/SYSTEM_SPEC.md` — 最新の確定仕様。古い会話・画像の文字より優先。
4. `docs/DECISIONS_AND_CORRECTIONS.md` — 矛盾修正と補完した実装判断。
5. `docs/INTEGRATION.md` — 実際に確認した統合先、UUIDを壊さない手順。
6. `docs/ACCEPTANCE_TESTS.md` と `docs/VALIDATION_REPORT.md` — 本番前の試験。

## 中身

- `pack/RP/`：**実物**の128×128 NPC UVアトラス、45個の直方体・12 bonesのgeometry、client entity、歩行・視線アニメーション、render controller。35枚の32×32透明アイコン（自然形状の手動最終パスを含む）、図鑑用ローカライズ、機能用胞子粒子。
- `pack/BP/`：35 item JSON、NPC entity JSON、鑑定・図鑑・状態異常・スポーン・死亡ドロップのJavaScript実装候補。
- `data/mushrooms.json`：35種のID、レア度、効果、科学解説、ブラックジョークを含む**唯一の編集元**。
- `data/sources.json`：科学情報の参照元と、どの主張に使った資料か。
- `docs/SCIENCE_CODEX.md`：人間向け図鑑原稿。機械用データから生成。
- `data/probabilities.csv`：各種の正規化済み確率。ゲーム内にこのCSVを配布しない。
- `tools/`：再ビルド・検証用ソース。NPCを再生成でき、キノコアイコンは `reference/final_32x32/` の承認版を最後に復元する。
- `tests/`：純粋ロジックと模擬APIテスト。**Minecraftそのものの試験ではない。**
- `previews/`：実際のgeometry/UVからの描画と35アイコンの一覧。ゲームへ入れない。
- `reference/`：承認済みNPCデザインの縮小参照。実装用UVではない。

## 使い方

**Codex統合が本命**です。このフォルダ全体を作業環境で開き、`CODEX_PROMPT.md` を渡してください。

別添 `.mcaddon` は、バックアップ済みの新規ローカルテストワールド用です。統合版と同時有効化しないこと。同じitem/entity identifierが衝突します。
`.mcaddon` の表示バージョンは1.2.0、品質区分は **handoff candidate / engine-untested** です。

新規ワールドでBP/RPを有効にして、互換エンジンで読み込めたことを確認後：

```mcfunction
/function mycology/give_test
```

赤64・茶64と、ドロップ権利のない管理用鑑定士が出ます。鑑定機能の確認用です。
**自然個体の死亡ドロップはこのコマンド個体では確認できません。** 詳しくは受入試験へ。

## 編集と再生成

```sh
python tools/build_assets.py
python tools/build_pack.py
python tools/validate.py
```

Python 3、Pillow、NumPy、jsonschema、Node.js 20以降が必要です。Node側に外部パッケージは不要です。
日本語フォントはプレビュー作成環境側で用意します。**フォントファイルは同梱していません。**
本文・効果の編集は `data/mushrooms.json`。`registry.js` や `.lang` を直接修正すると再生成で上書きされます。

## 重要な限界

この環境ではBedrockサーバーを起動していません。描画、タッチUI、ゲーム内クールダウン、AI、チャンク再読込、死亡イベントの実動はCodex/実機で確認してください。
配布用の型定義をネットワーク制約で取得できなかったため、検証はJSON・JS構文、参照、UV、純粋ロジック、模擬APIまでです。公式型定義を使った型検査や公式全スキーマ検証済みとは称しません。
