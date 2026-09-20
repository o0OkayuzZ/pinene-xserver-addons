# NF統合の引き継ぎ記録（2026-09-20）

## 調査結果

作業開始時点でNF関連の未コミット実装が存在していた。これを引き継ぎ、生成元 `tools/mycology` と統合先BP15/RP2を検証・補完した。

- 正式対応表：Downloadsの `NF_001-020_CODEX_LITE.zip` 内 `formal/nether_fungi_master_v1.0.json`。プロジェクトのマスターと全内容が一致。
- NF-001〜020：`NF_001-020_TEXTURE_FINAL_v4.zip` のtextures内PNG。
- NF-021〜100：`NF_FINAL_HANDOFF_PACKAGE(1).zip` の `FINAL_PNGS/NF-021.png`〜`NF-100.png`。
- 100枚すべて正本とバイト一致。reference・生成RP・統合RPの3か所で照合。再描画・変形・再エンコードなし。
- NF-001〜020の摂食・特殊効果は、現行定義・正式マスターに存在しなかった。全NFは性能未設定の標本として実装。既存Mycology35種の性能は維持。
- 旧マスターにある `pending_final_art` などは過去の制作メタデータ。完成PNGの採否には使用しない。

## 変更・維持したファイル

- `data/nether_fungi_master_v1.0.json`：正式100種。変更せず使用。
- `reference/nether_fungi/`、`data/nether_fungi_assets.json`：採用PNGとSHA-256。
- `tools/build_items.py`、`tools/build_pack.py`：registry・100アイテム・atlas・名称・配布function生成。画像数の固定上限を撤廃。
- `pack/BP/scripts/mycology/{registry,core,appraisal,progress,ui,reveal_sounds}.js`：既存Mycologyへ深紅・歪んだカテゴリを統合。
- `tools/integrate_active.py`：BP15/RP2へ対象ファイルを同期し、atlas・言語ファイルは既存項目を保持してマージ。
- `behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/items/golden_food_guide.json` と `tools/build_golden_foods.py`：グリントを有効化し、再生成時にも維持。
- 自動テスト：全NFの鑑定取得・カテゴリ・保存、図鑑全ページの名称/アイコンを確認。既存UIの総数・ボタン位置の期待値を更新。金食糧のグリントテストは実際の統合BPを参照するよう修正。

## 実装仕様・拡張

IDは `pinene:nf_001`〜`pinene:nf_100`、texture keyは `pinene_myco_nf_001`〜`pinene_myco_nf_100`。
深紅の入力は `minecraft:crimson_fungus`、歪んだ入力は `minecraft:warped_fungus`。分類・抽選ウェイトは正式マスターを使用し、各カテゴリ内で正規化する。各50種。既存35種と合わせて図鑑135種。

将来は承認済みの新規エントリを番号順にマスター末尾へ追加し、同番号の正式PNGをreferenceへ追加する。生成処理はマスターから件数を取得する。100を上限にしない。既存エントリの順序・系統は変更しないこと（発見フラグの位置を保持するため）。進捗は30bit分割で拡張でき、図鑑の件数・ページ数・抽選対象もregistryに追従する。今回の100種・50/50というリリース検査は将来の承認範囲に合わせて更新する。NF-096〜100の特別な終端処理はない。

## 検証と残作業

- Mycology：61テスト合格、内部整合2253チェック合格。
- 金食糧：45テスト合格。
- `tools/verify_nf_sources.py`：正式マスター、100種の統合アイテム・atlas・日英名称、PNG300コピー、同期スクリプト、グリントを照合。
- 正本ファイル名・ZIP内パス・SHA-256は `NF_SOURCE_AUDIT.json` に記録。
- 統合RPの既存言語項目はHEADと比較して値の変更がないことを確認。

Minecraft実機のロード・インベントリ表示・グリント・ガチャ操作は未検証。サーバーへの配布は行っていない。実機では深紅/歪んだ双方の鑑定、図鑑の各5ページ、NF-080を含む正式テクスチャ、金食糧図鑑のグリント、従来35種の食用/特殊効果を確認する。

再検証：`python -X utf8 tools/validate.py`（Node.jsがPATHに必要）、`python -X utf8 tools/verify_nf_sources.py`（Downloadsの正本ZIPが必要）。統合先はリポジトリ内 `behavior_packs` / `resource_packs` であり、作業フォルダー直下は実行用パックではない。
