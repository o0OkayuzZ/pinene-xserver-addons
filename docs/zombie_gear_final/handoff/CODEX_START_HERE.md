# CODEX START HERE — Zombie Gear Final Handoff

このZIPを唯一の引き継ぎ資料として扱ってください。

## 対象
- Repository: `o0OkayuzZ/pinene-xserver-addons`
- GitHub main で引き継ぎ時に確認した HEAD: `08b41ef55689c1dce2f5119f10ecbb1294f18812`
- ただし **ローカル/リモートに新しいコミットがある場合は絶対に巻き戻さず、最新状態へ差分適用すること**。

## 最重要
1. `references/ACCEPTED_ZOMBIE_GEAR_REFERENCE.png` が **ビジュアルの最終決定版 / source of truth**。
2. 過去チャット・旧生成画像・旧v4見た目より、この画像を優先する。
3. runtime item ID は既存の **4部位 × C0〜C4 = 20 IDを維持**する。
4. アイテムアイコンは各20種を **32×32 RGBA透過PNG、正面向き**で実装。
5. 装着3Dモデル/テクスチャも20種を参照画像のC0〜C4に合わせて更新。
6. チェストプレートのみ、**プレイヤー左肩（正面から見て右側）に目玉**。全C段階で存在。
7. gameplay は `docs/SPEC_FINAL.md` を厳守。
8. 既知バグ修正は `docs/IMPLEMENTATION_AND_BUGFIX.md` を全件対応。
9. 完了前に `docs/ACCEPTANCE_TESTS.md` を全項目確認。

## 実装方針
既存Zombie Gear BP/RPに統合し、他アドオンを壊さないこと。
既存ID・プレイヤー所持品・耐久・エンチャント・Lore等を可能な限り後方互換で保持すること。

まず現状コードを読み、変更計画を短く出した後、実装→テスト→差分報告まで完了してください。
