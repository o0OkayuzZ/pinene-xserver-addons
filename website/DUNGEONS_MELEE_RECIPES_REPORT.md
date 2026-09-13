# Dungeons近接武器レシピの追加（2026-09-13）

最新main `3b66fddebe8006ea5f3656d509bf833d7594a09f` を取得し、前回のDungeons監査commit `4a948e25ad9930a4a0667c093de670230bf3d9fc` とBP/RP全体に差分がないことを確認しました。新レシピは最新commitのGitオブジェクトから読み取り、ゲームの作業ファイルは変更していません。

## 追加した内容

近接武器レシピ52件を追加しました。素材から作る剣・鎌・ラッシュスピアの3件と、元の装備1個と青色の設計図1枚を使う設計図レシピ49件です。材料数・配置・完成数と完成品詳細へのリンクを掲載しました。設計図の結果欄は同じ装備が1個ずつ2枠あるため合計2個と表示し、初めて装備を入手するための素材レシピとは区別しています。実機での製作や耐久値・エンチャントの引き継ぎは未確認です。

Dungeonsは506項目（アイテム309・レシピ194・機能3）、Web全体707項目になりました。未掲載はアイテム176定義とレシピ74ファイルです。未掲載レシピの内訳は近接武器24、アーティファクト24、遠距離14、ブロック8、その他4。アイテムには旧版・限定・入手不可の定義が含まれるため、残り250件すべてを公開できるという意味ではありません。Mob・AIの説明などはこの残数に含めていません。

## 変更ファイル

`src/data/field-guide.json`、`src/data/dungeons-guide.json`、`scripts/add-dungeons-melee-recipes.py`、`scripts/audit-dungeons-remaining.py`、`tests/dungeons.spec.ts`、`artifacts/dungeons-melee-recipes-audit.json`、`artifacts/dungeons-remaining-audit.json`、検証画像・この報告。

専用Webブランチと[PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1)へ反映します。mainへの直接push・mergeや、MinecraftのBP/RP・UUID・manifest・ワールド・Xserver設定の変更は行いません。

## 検証・公開

依存関係の変更なし。データ検証成功、型確認51ファイルでエラー・警告なし、production build 733ページ。390px・768px・1440pxのDungeonsブラウザテスト6件、公開分離テスト4件が成功しました。ソース5da96261、公開生成物c69e9f1d009c110a95fdb01e4ba7f3f014b2154a。[配置](https://github.com/o0OkayuzZ/pine-server/actions/runs/34733053582)成功。

実際に[公開Dungeons](https://o0okayuzz.github.io/pine-server/contents/minecraft-dungeons/)で52件を展開し、[剣のレシピ](https://o0okayuzz.github.io/pine-server/database/entries/dungeons-sword-recipe/)と[ファイターズバインディングの設計図](https://o0okayuzz.github.io/pine-server/database/entries/dungeons-fighters-bindings-blueprint-recipe/)を390px・1440pxで開きました。HTTP 200、横はみ出しなし、JavaScriptエラーなし。

[PCのレシピ](artifacts/public-dungeons-sword-recipe-1440.png) / [スマホのレシピ](artifacts/public-dungeons-sword-recipe-390.png) / [PCの設計図](artifacts/public-dungeons-fighters-bindings-blueprint-recipe-1440.png) / [スマホの設計図](artifacts/public-dungeons-fighters-bindings-blueprint-recipe-390.png)。
