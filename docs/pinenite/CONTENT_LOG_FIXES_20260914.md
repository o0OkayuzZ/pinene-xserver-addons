# 2026-09-14 Content Log 修正

調査対象は `ContentLog2026-09-14_21-40-43_1.txt`（116,557 行、18,346,008 bytes）。作業前と反映前に GitHub main を取得し、`559feb4d` からの差分を確認した。

## 原因と修正

| ログ・症状 | 修正 |
|---|---|
| `pinenite_outline` material 未定義 | Bedrock が読む `materials/entity.material` に定義。下位 RP の既存 material 定義を保持して追加する。旧ファイルは空のカタログとして残す。 |
| 条件付き render controller が文字列以外として拒否される | 輪郭 RP の client entity を 1.10.0 に統一。旧 `animation_controllers` は既存 alias と animate を保持して移行。 |
| `neverRender` / `bind_pose_rotation` / `reset` が modern geometry で不正 | 該当モデルを 1.8.0 の別 geometry ファイルへ分離。混在形式の dummy は modern 形式で、非表示骨の自身の cube のみを除外し、子骨・回転を保持。元アドオンのモデルには変更しない。 |
| `variable.melee_spear_equipped` 未定義（31,448 回） | player の pre_animation で装備タグから初期化。 |
| 同期 animation の空 bones が拒否される | 空の bones キーを省略し、同期 animation の時間と loop を保持。 |
| illusioner / royal_guard の `riding.body` 未定義 | 公式 vanilla に存在する `animation.humanoid.riding.body` alias を補完。 |
| フィギュア回収の `safeHasTag` ReferenceError | コメントアウト済み試作関数ではなく、有効な既存 `pineHasTag` を呼ぶ。 |
| blue diamond apple 2 レシピの unlock 欠落 | blue apple を解放条件として追加。材料・出力は維持。 |
| 音素レシピの `myname:all_cds` tag 未定義 | 有効な `minecraft:music_disc` tag を使用し、既存 Pine CD 19 定義にも同じ tag を付与。ID・音源・枚数条件は維持。 |
| GoldenFoods のロード途中 Entity への dynamic property アクセス | effectAdd と遅延 callback で Entity の有効性を確認。 |
| Dungeons クロスボウの geometry / texture alias 不一致 | 6 attachable を専用 render controller に接続。待機・引き・装填済みの既存 alias を選択。Zombie Gear の同名 controller は変更しない。 |

`tools/pinenite/build_outline_assets.py`、`tools/pinenite/build_combat_assets.py`、`tools/pinecd/build.py` も修正し、再生成で不具合が復活しないようにした。

## 保持・バージョン

- Pinenite の元モデル・PNG・ID・防御値 8/14/11/8・戦闘計算は変更していない。元ダメージ、反射再帰防止、対象別共生状態、15 秒更新の既存テストも再実行。
- Zombie Gear の BP (`bp_09`) / RP (`rp_07`) は変更ゼロ。
- Pine main BP は Zombie Gear がバージョンを固定して依存するため、既存 1.0.69 を維持し、修正ファイルのハッシュで配布確認する。共有インストール済み Death ペアも既存登録を壊さないよう 2.12.14 を維持。
- 統合ワールドでは Outline RP 1.0.2、Death BP 2.12.22、Dungeons ペア 2.0.8、PineCD BP 1.0.31、GoldenFoods BP 1.0.34。登録順序・他パックの登録は保持。

## 検証

- `npm test`: 160 件成功（うち Pinenite / 今回の回帰テスト 59 件）。
- PineCD Python テスト: 6 件成功。`build.py --check`: 差分 0。
- `validate_pinenite.py`: 157 検査成功、登録警告 0。既存 Pinenite の 205 cube とテクスチャ保持も検証。
- Script API 2.6 の型検査成功。
- ローカル 2 ワールドへの反映前検査成功。実際の配布結果は同ディレクトリの rollout 記録を参照。

今回、旧テストが検出できなかった実際の client schema / material 読み込みエラーを修正した。自動テスト成功はクライアントの描画成功を意味しない。

旧 geometry の cube は rotation / pivot を受け付けないため、これらが旧形式ファイルへ混入しない検査も追加した。形式の根拠は [Microsoft の geometry 1.8.0 スキーマ](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/schemasreference/schemas/minecraftschema_geometry_1.8.0?view=minecraft-bedrock-stable)。変更ファイルと検証記録は [content_log_fixes_20260914](content_log_fixes_20260914/) を参照。

## 残る実機確認

- 修正版でワールドを開いた後の Content Log と、自分・敵の輪郭、子供 / 防具 / 騎乗モデル、クロスボウ全段階の描画を確認する必要がある。
- item binding の骨参照エラーは geometry 読み込み失敗による連鎖の可能性があり、新ログで再判定する。
- `sounds/monstrosity/core_reload` の音源が既存 RP に存在しない。別の音へ勝手に置換していない。
- Lighting のメンバー / 範囲警告はログに対象ファイルがなく、原因未確定。今回の修正対象外。
- `pinene_pvp:dragon_relic_block` の旧 block 定義警告が残る。
- 防御値 8/14/11/8 のエンジン上限・実際の被ダメージ測定は、今回の静的検査では確認できない。数値を勝手に補正していない。
