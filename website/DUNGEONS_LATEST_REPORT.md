# 最新mainの照合と遠距離レシピ追加

2026年9月12日にoriginをfetchし、main `4a948e25ad9930a4a0667c093de670230bf3d9fc` と現在のWeb専用ブランチを確認しました。mainにはwebsite/がなく、専用ブランチが最新Web実装であるため、その実装を維持して更新しました。ゲーム側の作業ツリーへmainを上書き・mergeしていません。

## 最新版との照合

- Dungeons BP/RPは2.0.4から2.0.6へ更新されていました。9月12日の導入・起動記録を確認し、Webの技術情報を更新。
- 既存のDungeons図鑑が参照する根拠ファイルを最新版のGitツリーと照合。変更された14ボス報酬テーブルは、無効な単独`waystone:waystone`の除去以外に差がないことをJSONとして比較しました。
- Dungeonsのアイテム・レシピ・翻訳・画像のディレクトリに差分がないことを確認。既存Dungeons図鑑の確認commitを最新版へ更新しました。
- 選定パックのバージョンと登録状態を最新版のmanifest・world登録に照合し、変更のあった4レコードを更新。これ自体を各コンテンツの全機能検証とはしていません。
- 最新DungeonsにはMob・AI等の変更もあります。それらの戦闘挙動や、Mycology・無限城・Zombie Gear等の全説明の再監査は今回の範囲に含めていません。

確認記録：[dungeons-latest-audit.json](artifacts/dungeons-latest-audit.json)。`scripts/update-dungeons-latest.py`は固定commitのGitオブジェクトを読み、ゲームファイルを変更せずに比較・登録します。

## 追加した32レシピ

弓・クロスボウの製作3件と、設計図レシピ29件を追加しました。Dungeonsは454項目（アイテム309・レシピ142・機能3）、Web全体640項目（アイテム421・レシピ197・機能22）、665ページです。

設計図レシピは、青色の設計図1枚と同じ装備1個が材料です。結果欄に同じ装備が1個ずつ2枠あり、表示上は合計2個としています。元の装備が必要であること、素材から初めて作るレシピとは違うことを明記しました。実際の製作可否、耐久値やエンチャントの引き継ぎ、返却品と新規品の区別は未確認です。

未掲載はアイテム176定義、レシピ126ファイル。旧版・限定・入手不可の定義を含むため、全件を公開する約束ではありません。

## 変更ファイル

`src/data/field-guide.json`、`content-registry.json`、`pack-registry.json`、`dungeons-guide.json`、`src/pages/contents/[id].astro`、`scripts/update-dungeons-latest.py`、`scripts/audit-dungeons-remaining.py`、`tests/dungeons.spec.ts`、README・実装記録・公開記録、集計JSONとスクリーンショット。

## 検証

依存変更なし。データ検証成功、Astro型確認35ファイルでエラー・警告0件、production build 665ページ、公開分離単体テスト4件成功。private/draft識別データを投入した実ビルドでも混入なしを確認し、元データを復元して再ビルド済みです（出力監査683テキスト資産）。Chromium 390px・768px・1440pxの24テストが成功し、公開図鑑640ページを各幅で巡回しました。画像・リンク・分類移動・32件の一覧展開・設計図材料と完成数・完成品への往復・横はみ出しを確認しました。

[PC全体](artifacts/dungeons-desktop-1440.png) / [スマホ全体](artifacts/dungeons-mobile-390.png) / [タブレット全体](artifacts/dungeons-tablet-768.png)

## 実際に確認した公開URL

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-harp-crossbow-blueprint-recipe/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-dual-crossbows-recipe/

上記3URLを公開先のChromiumで390px・1440px確認し、HTTP 200、画像・リンク・32件展開・v2.0.6表示・横はみ出しなし・JavaScriptエラーなしを確認しました。[PC](artifacts/public-dungeons-latest-1440.png) / [スマホ](artifacts/public-dungeons-latest-390.png) / [設計図のスマホ表示](artifacts/public-dungeons-blueprint-390.png)。ソースcommitは`0cfcb6b1`、配置は成功。詳細は[PUBLISH_REPORT.md](PUBLISH_REPORT.md)に記録しました。Web以外のBP/RP、UUID、manifest、ワールド、読み込み順、Xserver設定は変更していません。専用ブランチと既存PR #1へ追加し、mainへの直接push・自動mergeは行っていません。参加URLとゲーム実機での製作・操作確認は引き続き未設定・未確認です。
