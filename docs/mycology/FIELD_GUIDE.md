# 携帯用キノコ図鑑

`pinene:mushroom_field_guide` を追加しました。本＋赤キノコ＋茶キノコを作業台でクラフトして入手できます。手に持って使うと、鑑定士の近くでなくても個人のキノコ図鑑を開けます。使用しても消費されません。

```mcfunction
give @s pinene:mushroom_field_guide 1
```

発見条件は既存どおり鑑定です。発見した種類だけ名前・星・画像・解説が表示され、未発見は伏せられます。本の所持・譲渡・/giveで図鑑は埋まりません。進捗は本ではなくプレイヤーに保存されるため、本をなくしても残り、別の人へ渡しても記録は移りません。

鑑定士と携帯図鑑で同じ画面ロックを使い、連打や同時オープンを防ぎます。閉じた場合・例外が発生した場合はロックを解放します。既存の発見記録・キノコ35種の仕様とv1.4画像は保持しています。

## 変更

- BP: `items/mycology_tools/field_guide.json`、`recipes/mycology_field_guide.json`、`scripts/mycology/field_guide.js`を追加。既存Mycologyの`index.js`で登録。
- RP: `textures/items/mycology_tools/field_guide.png`、atlasの`pinene_myco_field_guide`、日本語・英語のアイテム名を追加。
- authoringにも同じ変更を反映。`tools/build_field_guide.py`でアイテム・レシピ・atlas・言語・画像を生成し、既存ビルダーから呼び出すようにしました。
- imagegenで作った原画像と32×32 RGBA原本は`tools/mycology/reference/field_guide/`に保存。runtimeは32×32のみです。キノコ35枚とは別の画像ディレクトリを使います。
- 統合BP 1.0.64→1.0.65、統合RP 1.0.55→1.0.56。依存するZombie gear BP 1.0.9→1.0.10、対応RP 1.0.15→1.0.16。依存version・world参照を同期し、UUIDと適用順は維持。

## 検証

- 自動テスト32件合格。新規テストで個人別の未発見表示、閲覧による発見・他人の記録移行がないこと、連打・NPC画面との排他、終了・例外時のロック解除を検証。
- 静的検証1773項目と統合検証が合格。公式server 2.7/server-ui 2.0型定義でのcheckJsも合格。
- 隔離コピーで全体ビルドを行い、図鑑アイテム・レシピ・PNGの一致と、既存35枚のv1.4 SHA-256一致を確認。
- Windows v26.45のローカル統合ワールドで、NPCから離れた場所から図鑑を使用し、既存の発見34/35の画面が開くことを確認。[実機画面](evidence/field-guide/open.png)。
- 実機で見つかったレシピのunlock不足を修正し、本の入手でレシピを解放する設定を追加。[公式レシピ仕様](https://learn.microsoft.com/en-us/minecraft/creator/documents/recipeintroduction?view=minecraft-bedrock-stable)に沿った修正です。修正後のクラフト実操作は未確認です。
- 複数端末・タッチ操作・クラフト画面での実操作は未確認。

本番サーバーへの配備・pushは行っていません。
