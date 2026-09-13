# Dungeons未掲載分の一括追加（2026-09-13）

最新main `3b66fddebe8006ea5f3656d509bf833d7594a09f` のGitオブジェクトを読み、未掲載のアイテム定義176件・レシピ74ファイルを全件分類しました。ゲームのBP/RP、UUID、manifest、ワールド、読み込み順、Xserver設定は変更していません。

## 追加内容

- 近接武器25件・遠距離武器14件と、素材から作るレシピ37件。
- 通常アーティファクト24件・レア版38件・限定版1件と、通常版のレシピ24件。
- 限定防具12部位、鍵18件、ルーン9件、絵画14件、その他のアイテム6件。
- 建築等のブロック9件と、ブロック・道具・素材のレシピ12件。

計243項目を追加しました。Dungeonsは506→749項目、Web全体は950項目・976ページです。アイテム定義485件のうち470件を掲載し、別途9件のブロックを掲載しています。レシピは268ファイル中267ファイルを掲載しました。全未掲載分は除外理由と対応し、未分類の残件はありません。

実アイテム画像と定義・処理を根拠に、用途、使用条件、材料、完成品へのリンクを掲載します。レシピ図鑑にはコンテンツと名前・材料による検索を追加し、Dungeons紹介から直接移動できます。

## 公開判断で区別したこと

レア版の弱化のドラとハーベスターは、現行アイテム定義が通常版の処理を指定しています。名称からレア版の数値を当てはめず、実際の指定に沿って説明しました。限定装備も、現在の配布期間や実機での取得を保証していません。

レイピアは元レシピの行幅が3・3・2文字と不揃いです。空欄を補って通常レシピとして公開することはせず、本体側に製作可否未確認と記載しました。旧アイテム13定義と入手不可の近接武器2定義も通常掲載から除外し、除外理由を監査記録に残しました。

鍵やルーンのうち使い道・入手先を確認できなかった部分、蘇生処理の挙動などは未確認と明示しています。設計図や元の道具を材料にするレシピは、最初の1個を入手するレシピと区別しています。

## 変更ファイルと再確認

掲載データは`src/data/field-guide.json`と`dungeons-guide.json`、紹介文は`content-registry.json`。`public/images/items/`へパック内画像をコピーしました。レシピ検索は`src/pages/database/recipes.astro`、`GuideCard.astro`、`DungeonsGuide.astro`で実装しています。

分野別の生成・根拠は`scripts/batch-dungeons-*.py`と`artifacts/batch-*.json`、統合は`scripts/merge-dungeons-batches.py`。`artifacts/dungeons-bulk-audit.json`と`dungeons-remaining-audit.json`が全追加ID・除外理由・未掲載ファイルを記録します。件数はMobや全スクリプトの網羅率を意味しません。

## 未確認事項

実際のゲーム内での製作、戦闘性能、期間限定品の配布、入手・使用操作は未検証です。公開Webのアクセス集計は既存設定を維持しており、管理画面に実データを取り込むための秘密の読み取り認証は今回のコンテンツ追加では設定していません。

## 検証

依存関係を確認（変更なし）。データ検証成功、型確認51ファイルでエラー・警告・ヒント0件、production build 976ページ。Dungeonsと図鑑のブラウザテスト15件が成功し、390px・768px・1440pxで950ページを各幅ですべて巡回しました。レシピ検索の材料一致・URL復元・空結果とリセット、分類展開、製作素材数と完成品への往復、画像・リンク・横はみ出しを確認しています。

公開分離単体4件と、識別用の非公開・下書きデータを入れた実ビルドの混入検査が成功。出力995テキスト資産に内部パス・生JSON・旧ブランド等の混入はありません。根拠のクロスレビューでは武器37レシピを全件、アーティファクトの例外的な効果指定や一部レシピを独立照合しました。テスト中の計測スクリプトは遮断し、架空の訪問集計を作っていません。

[PCのアーティファクト](artifacts/dungeons-bulk-artifact-1440.png) / [スマホのアーティファクト](artifacts/dungeons-bulk-artifact-390.png) / [PCのレシピ検索](artifacts/dungeons-bulk-search-1440.png) / [スマホのレシピ検索](artifacts/dungeons-bulk-search-390.png)

## 実際の公開URL・commit

実装commit `643f644e`、公開生成物 `bc25dd48c363171f3b920b08c570b41f7a95b7d2`。[Pages配置](https://github.com/o0OkayuzZ/pine-server/actions/runs/34733995246)は成功しました。以下を390px・768px・1440pxで確認し、HTTP 200、画像表示、横はみ出しなし、JavaScriptエラーなしでした。

- [Dungeons紹介](https://o0okayuzz.github.io/pine-server/contents/minecraft-dungeons/)：749項目と追加した7分類を確認。
- [Dungeonsのレシピ検索](https://o0okayuzz.github.io/pine-server/database/recipes/?content=minecraft-dungeons)：267件から「ダイヤモンドの粉」で40件へ絞り込み。
- [ガーディアンの目・レア](https://o0okayuzz.github.io/pine-server/database/entries/dungeons-rare-eye-of-the-guardian/)
- [古代の鍵](https://o0okayuzz.github.io/pine-server/database/entries/dungeons-ancient-key/)
- [砂漠のレンガ](https://o0okayuzz.github.io/pine-server/database/entries/dungeons-desert-bricks/)
- [弱化ドラ・レア](https://o0okayuzz.github.io/pine-server/database/entries/dungeons-rare-gong-of-weakening/)：ダメージ補正の対象外条件を含む最終説明を確認。

上のスクリーンショットは公開サイトで撮影したものです。専用Webブランチへpushし、[PR #1](https://github.com/o0OkayuzZ/pinene-xserver-addons/pull/1)の説明も現在の実装・検証結果へ更新しました。
