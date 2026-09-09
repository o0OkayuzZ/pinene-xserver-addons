# 既存リポジトリへの統合

## 読み取り確認した状態（2026-09-09）

リポジトリ：`o0OkayuzZ/pinene-xserver-addons`、branch `main`。
READMEは2026-09-07時点のスナップショットを説明し、既存のUUIDとロード順を維持する構成。

- 統合BP：`behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/`
- 統合RP：`resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/`
- **BPの実際のheader UUID：`2b9dbf4f-7f7a-4e97-9687-4864e4f6f501`**。ディレクトリ名のUUIDと同じとは限らない。
- 確認時BP版：1.0.63。RP依存：`3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a` / 1.0.54。
- Script：`scripts/main.js`、JavaScript。
- 依存：`@minecraft/server 2.7.0` / `@minecraft/server-ui 2.0.0`。
- 既存mainには複数システムと既存の常時処理がある。今回の追加を理由にそれらを全消去・全書換えしない。

リポジトリの読み取りだけを実施した。**GitHubへのコミット／push、実サーバーへの配備は行っていない。** 作業開始時にCodexがHEADとmanifestを再確認すること。

参照：
- https://github.com/o0OkayuzZ/pinene-xserver-addons/blob/main/README.md
- https://github.com/o0OkayuzZ/pinene-xserver-addons/blob/main/behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/manifest.json
- https://github.com/o0OkayuzZ/pinene-xserver-addons/blob/main/behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/main.js

## マージ方法

1. 別ブランチでバックアップし、現在の最小実行版／2.7 API対応状況を確認する。付属の最小engine宣言1.21.90はJSON形式の下限で、当該版がAPI2.7を提供するという意味ではない。
2. `pack/BP/items/mycology/`、`entities/mushroom_appraiser.json`、`scripts/mycology/`、必要ならテストfunctionを統合BPにコピーする。
3. 既存main.jsへ `import "./mycology/index.js";` を1回だけ追加する。付属main.jsはテストパックの入口であり置換用ではない。
4. RPの `entity` / `models` / `animations` / `render_controllers` / `particles` / 該当 `textures` を名前空間が衝突しない形で追加する。
5. `textures/item_texture.json` は `texture_data` 内の `pinene_myco_*` を**マージ**する。ファイル全体を上書きしない。
6. `.lang` は既存ファイルに新規キーだけマージ。同じ値の重複キーは1つへ。`languages.json` は既存ロケールを維持する。
7. 既存header/module UUIDを保持してバージョンを上げ、RP依存・root/world pack参照を同時に整合させる。配布用TEST manifestの新UUIDを既存BPへコピーしない。
8. 既存アイテム・モデル・UIの回帰試験を実施し、リソース更新が別プレイヤーにも配信されたことを確認する。

Dynamic Propertyはパックの同一性とセットで扱う。統合後にUUIDを替えるとセーブの参照関係が変わりうる。テスト用スタンドアロンの進捗をそのまま本番BPに移せるとは約束しない。

## 新規identifier

Entity：`pinene:mushroom_appraiser`
Items：`pinene:r_mushroom_r01`〜`r15`、`pinene:b_mushroom_b01`〜`b20`。
Custom components：`pinene:myco_consume`、`pinene:myco_crush`。
Geometry：`geometry.pinene.mushroom_appraiser`。
Particle：`pinene:myco_spore`。
Render controller：`controller.render.pinene.myco`。
既存側の同名定義が見つかったら自動二重登録せず、差分を調べて一本化する。

## 復旧の手順

通常操作でレシートが `delivered`、`inFlight=null` なら次のNPC操作時に未配布だけ再試行する。
強制終了で `prepared` / `inFlight` が残った場合は、管理者が実所持品・周囲ドロップ・レシートを確認してから処理する。以下は**対象プレイヤー本人が管理者により一時的に付与されたタグを持つ時**だけ使える。

```mcfunction
/tag <対象プレイヤー> add pinene:myco_admin
```

対象プレイヤー側：

```mcfunction
/scriptevent pinene:myco_receipt inspect
```

管理者が所持品への書込完了を確認した後だけ `accept_committed`。
保留中の1スタックが既に落ちていたなら `discard_inflight`。
未出力を確実に確認した時だけ `retry_inflight`。
手作業で過不足を精算し終えた時だけ `clear_after_manual_reconcile`。

```mcfunction
/tag <対象プレイヤー> remove pinene:myco_admin
```

この仕組みはバックアップの代わりではない。曖昧な状態で `retry_inflight` を選ぶと複製になるので、確認せず押す復旧ボタンを通常UIに設けていない。
