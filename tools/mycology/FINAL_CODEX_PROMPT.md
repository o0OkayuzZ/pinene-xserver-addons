Approved extension: portable field guide item. See ../../docs/mycology/FIELD_GUIDE.md. This addition does not change the 35 mushroom definitions or v1.4 mushroom textures.

# Current integration priority

System: v1.3, including validated stable API fixes. Mushroom images: v1.4. Read [CODEX_TEXTURE_UPDATE.md](docs/texture_v1.4/CODEX_TEXTURE_UPDATE.md) first for images. The v1.3 visual override below is historical and is superseded by v1.4 for all 35 icons. `reference/final_32x32/` is the only build source.

# v1.3 visual override

Before integration, read `docs/TEXTURE_PASS_v1.3.md`. B16–B20 in this package are the latest user-approved individual visual candidates and override any older preview/reference images for those IDs. Keep all IDs and texture keys stable; image swaps must remain drop-in replacements.

# FINAL CODEX PROMPT — Pinene Mycology v1.2 handoff

`o0OkayuzZ/pinene-xserver-addons` に、このフォルダのキノコ鑑定士システムを統合してください。
最初に `00_README_FOR_CODEX.md`、`docs/SYSTEM_SPEC.md`、`docs/INTEGRATION.md`、`docs/TEXTURE_PASS_v1.2.md`、`docs/ACCEPTANCE_TESTS.md` を読み、既存リポジトリを解析してから編集してください。

## ゴール

赤色のバニラキノコから15種、茶色のバニラキノコから20種、計35種の実在キノコを鑑定する軽量なBedrockアドオン機能を、既存のピネン統合BP/RPへ安全に統合する。

実装対象は、35 item、キノコ鑑定士NPC、1スタック一括鑑定、個人別図鑑、科学解説、食用/毒性ゲーム効果、低頻度スポーン、自然個体死亡ドロップ、32×32アイコン、NPCモデル/UV/アニメーションです。

## 絶対に守ること

- 既存manifest UUID、pack load order、既存namespace、既存Scriptを無断で置換しない。
- `pack/BP/scripts/main.js` は単独テスト用。既存main.jsへ上書きせず、必要なimportだけ重複なく統合する。
- 本番サーバーやworld DBへ直接配備しない。テスト用ブランチ/コピーで検証する。
- 毎tickで全プレイヤー、全Mob、全インベントリ、35種全件を走査する実装は禁止。
- 仕様にない研究システム、ポーション、料理、買取、戦闘AIを勝手に追加しない。
- 実世界の科学説明とMinecraft上のゲーム表現を混同しない。根拠のない化合物・薬理作用を追加しない。

## 鑑定仕様

- 入力はバニラ `minecraft:red_mushroom` / `minecraft:brown_mushroom`。
- ボタンを押した時点で、インベントリ内の**最初の該当スロット1つ**を再確認し、そのスロット内の全量1〜64個を鑑定する。
- 各1個を独立に weighted random し、結果は種類ごとに集約して付与する。
- rarity weight = `2^(10-rarity)`。赤合計2899、茶合計3183。
- インベントリに入り切らない結果は消失させずプレイヤー足元へスタック単位で落とす。
- 発見済み/未発見はプレイヤー別に永続保存する。未発見の名称、学名、レア度、科学本文、効果を図鑑から漏らさない。
- ★10の R15/B15 は specimen-only。食料化しない。

## NPC仕様

- Entity: `pinene:mushroom_appraiser`。
- 通知、台詞、派手な出現演出なし。機能NPCとしてシンプルにする。
- 世界共通で15分ごとに低頻度判定。通常4%、キノコ島20%。同時に有効自然個体は最大1体。
- 通常30分、キノコ島45分滞在。UI操作中だけ最大5分の猶予。
- 非戦闘、攻撃されたら逃走。殺害可能。
- **イベント経由で自然出現した個体だけ**、死亡時に `minecraft:red_mushroom x64` + `minecraft:brown_mushroom x64` を固定ドロップ。Looting増加なし。
- 管理用 `/summon` 個体やテストfunction個体、期限切れdespawnからは上記ドロップを出さない。

## テクスチャ仕様 v1.2

- runtime item texture は **全35種 32×32 RGBA PNG**。
- Source of Truth: `reference/final_32x32/`。runtimeは `pack/RP/textures/items/mycology/`。
- バニラ寄りの粗いピクセル感を維持し、スムージングや写実的な高解像度化をしない。
- ユーザーの視覚方針は「整いすぎない、左右非対称、少し傾く、自然に生えていた形」。ナメコなど群生種は大きさ・高さ・密度を不均一にする。
- B05 / B15–B20 / R13 / R14 は高解像度の個別確認版から32×32化済み。
- その他26種は承認済み16×16の最近傍2倍をベースにした32×32互換候補。ゲーム内で見え方が悪いものだけ後日PNG差し替え可能な構造を維持する。
- 画像を差し替える際もID、item identifier、texture key、registry順を変更しない。
- 高解像度参照画像やプレビュー画像をruntimeへ直接入れない。

## Bedrock/API互換性

このパックは `@minecraft/server 2.7.0` / `@minecraft/server-ui 2.0.0` を想定した候補実装だが、Bedrock実機では未確認です。統合先の現在のエンジン/APIバージョンを確認し、stable APIに合わせて必要最小限の修正をしてください。

特に確認すること：

- `playerInteractWithEntity` 相当のNPC操作イベント
- item custom component / consumeイベント
- Dynamic Propertyの保存と再起動後復元
- 遅延毒の再起動/牛乳解除
- UI二重オープン防止
- Entity死亡イベント内でのentity参照寿命
- チャンクアンロードとNPC寿命
- 共有cooldown category
- インベントリ書込失敗時のロールバック/足元ドロップ

## テスト

最低限：

```sh
npm test
python tools/validate.py
```

その後 `docs/ACCEPTANCE_TESTS.md` を実Bedrockテスト環境で実施する。

ゲーム内では以下を重点確認：

1. 赤/茶それぞれ1〜64個の一括鑑定で個数保存。
2. 64個を複数種へ分散しても消失しない。
3. 新規発見だけ図鑑bit/進捗が増える。
4. 同時操作・連打で二重消費しない。
5. B16ドクツルタケ等の遅延効果。
6. NPC自然出現/期限消滅/再起動。
7. 自然死亡だけ64+64、管理個体は0。
8. 35個の32×32アイコンがinventory、drop、図鑑UIで正常に見える。
9. NPC geometry、UV、歩行/視線アニメーション。
10. 既存アドオン機能に回帰不具合がない。

## 完了報告

最後に必ず以下を報告してください。

- 変更したファイル一覧
- 既存統合BP/RPのバージョン変更
- 実施した自動テストと結果
- 実施したゲーム内テストと結果
- 未実施項目
- 既知の制限/エラー
- runtimeのBP/RP容量
- テクスチャでゲーム内再調整が必要な種

**「静的テスト合格」と「Bedrock実機テスト済み」を混同しないこと。**
