# Dungeons 装備図鑑の追加

Dungeonsを68件から174件へ増やしました。今回の追加は106件です。

- 近接武器39件：斧、ダガー、レイピア、ソウルナイフ、ムチなどの未掲載装備。
- 弓・クロスボウ25件：雪・ヴォイド・風・爆発・ソウルなどの系列。
- 防具32件：ハチの巣、ハチの巣箱、ソウルローブ、ソウルダンサーローブ、オオカミ、キツネ、クモ、ウィザーを4部位ずつ。
- 特殊な矢5件と配置自由レシピ5件。

Web全体は360図鑑項目（アイテム267・レシピ71・機能22）、385ページ。Dungeons専用ページには近接56・遠距離35・防具48・アーティファクト8など、7種類の一覧があります。

## 変更ファイル

`src/data/field-guide.json`、`src/data/content-registry.json`、`src/data/dungeons-guide.json`、`public/images/items/dungeons-*.png`（101枚追加）、`scripts/expand-dungeons-equipment.py`、`tests/dungeons.spec.ts`、README・実装記録・公開記録、Dungeonsのスクリーンショットを更新しました。

## コードとの照合

ソースcommitは`aea85120954a8b74033b86253c17a04b691dab21`。BP08・RP06の個別アイテム、日本語名、画像アトラス、実画像を照合しました。近接・遠距離の追加対象は、ボスチェスト報酬から正の重みで参照される装備です。未入手用フォルダーや報酬経路を確認できなかった定義は今回の追加対象にしていません。

武器・防具には耐久値、ダメージ成分または防御値、確認できた修理材料を記載。特殊効果やセット効果を名称から推測していません。数値は設定値であり、戦闘時の最終ダメージや修復量ではありません。

矢はアイテムから発射先エンティティ、対応武器の弾薬候補、レシピへの対応を照合。銛の矢は矢4個と鉄インゴット2個から6個、花火の矢はTNT4個と矢1個から1個など、実際のレシピごとの個数を保持しています。

## 検証

依存関係の変更なし。データ検証成功、型確認35ファイルでエラー・警告0件、production build 385ページ、公開分離テスト4件成功。390px・768px・1440pxのChromiumで24テストが成功しました（各幅で全360図鑑ページを巡回）。防具48件への展開と、銛の矢の完成数6個・材料・配置自由表示・完成品リンクも確認しました。

private/draft識別データを投入した実ビルドと復元後のビルドで出力監査成功。Dungeons174項目が重複なく種類別一覧へ掲載され、根拠ファイルが存在することを照合しました。ゲーム側ファイルは根拠commitから変更されていません。

[PC全体](artifacts/dungeons-desktop-1440.png) / [スマホ全体](artifacts/dungeons-mobile-390.png) / [タブレット全体](artifacts/dungeons-tablet-768.png)

## 確認対象URL

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/items/?content=minecraft-dungeons
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-harpoon-arrow-recipe/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-wither-leggings/

公開先の検証とcommitは[PUBLISH_REPORT.md](PUBLISH_REPORT.md)に記録します。

## 未確認事項

実ゲームでの戦闘性能、特殊効果・セット効果、修理、製作・解放表示、ボス戦・入手操作は今回未検証です。報酬候補は確定ドロップを意味しません。参加URLは未設定、大きな紹介イラストは引き続き仮素材です。

変更はWebのみ。ゲームパック、UUID、manifest、ワールド、読み込み順、Xserver設定は変更しません。専用Webブランチ・既存PR #1へ追加し、mainへの直接pushや自動mergeは行いません。
