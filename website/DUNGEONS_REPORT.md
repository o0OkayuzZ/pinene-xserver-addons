# Minecraft Dungeons 優先更新

Minecraft Dungeonsを2件から68図鑑項目へ拡張しました。追加は66件（アイテム52・レシピ11・機能3）。Web全体は254項目（アイテム166・レシピ66・機能22）、279ページです。注目コンテンツ4件の構成を保ち、Dungeonsの紹介を優先して充実させています。

## 内容と変更ファイル

- `src/data/field-guide.json`：近接武器16、弓・クロスボウ10、防具16、通常版アーティファクト8、素材2、レシピ11、収集・報酬・製作の説明3を追加。既存の英雄の書も説明を更新。
- `src/data/content-registry.json`：紹介文と遊び方、実装・導入記録の確認状態を更新。
- `src/data/dungeons-guide.json` / `src/components/DungeonsGuide.astro`：6種類の画像付き一覧、ページ内ナビゲーション、残りの装備を開く操作、英雄の書と素材の製作入口。
- `src/pages/contents/[id].astro`：Dungeons専用の図鑑入口と種類別一覧を配置。技術情報の実装・配備表示をデータに合わせて変更。
- `public/images/items/dungeons-*.png`：実際のパック内画像52枚。
- `scripts/add-dungeons.py`：今回のソース照合・登録用。ゲーム側は読み取り専用で、既存の追加IDがあれば停止します。ビルドでは実行しません。
- `tests/dungeons.spec.ts`：種類別ナビ、防具一覧の展開、詳細移動、英雄の書の製作配置と完成品への移動を検証。
- README・実装記録・公開記録と`artifacts/dungeons-*.png`。

## 確認した根拠

ソースcommit：`aea85120954a8b74033b86253c17a04b691dab21`。BP08とRP06の個別アイテム、アトラス、日本語名、画像、レシピ、報酬の入れ子参照を照合。重みが0の報酬は入手候補に含めません。候補に含まれることと、確定入手・すべてのボスからの入手は区別しています。

アーティファクトはアイテムのカスタムコンポーネント名と使用処理を照合しました。通常版とレア版を区別し、通常版の効果と基本クールダウンのみを掲載。回復トーテムの所有者向け回復増量は実処理で裏付けられないため掲載していません。武器の特殊効果や防具セット効果は、名前や翻訳だけから断定していません。

既存の導入文書に2026年9月9日のDungeons 2.0.4導入・起動確認が記録されているため、「リポジトリのみ確認」の一律表示を修正しました。現在の本番状態や全プレイ内容を確認済みとする変更ではありません。

## 検証と画面

依存変更なし（Node 24.21.0 / npm 11.19.0）。データ検証、型確認35ファイルでエラー・警告0件、production build 279ページ。公開分離の単体テスト4件を実行しました。

Chromiumの390px・768px・1440pxで24テスト成功。各幅で全254図鑑ページとリンク・画像を巡回し、Dungeonsの展開操作とレシピ往復も確認しました。private/draft識別データを投入した実ビルドと復元後ビルドはともに出力監査成功（297テキストファイル）。

[スマホ390px](artifacts/dungeons-mobile-390.png) / [タブレット768px](artifacts/dungeons-tablet-768.png) / [PC1440px](artifacts/dungeons-desktop-1440.png)

## 確認対象URL

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/items/?content=minecraft-dungeons
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/book-of-heroes-recipe/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-death-cap-mushroom/

上記4URLを公開先で390px・1440px確認済みです。HTTP 200、画像、一覧展開、レシピへの移動、横はみ出しとJavaScriptエラーがないことを確認しました。実装commitは`e3d89694`、公開生成物は`116135f`。配置記録は[PUBLISH_REPORT.md](PUBLISH_REPORT.md)にあります。

## 未確認事項

ゲーム内の全装備の戦闘性能、セット効果、HUD、実際の製作・解放表示、ボスへの到達・鍵の入手・チェストを開く操作は今回未検証です。おいしい骨の材料`minecraft:golden_dandelion`は「金色のタンポポ（仮訳）」と表示し、実ゲームの名称・入手は未確認です。参加URLは未設定、紹介の大きなイラストは仮素材です。

変更はWebのみ。Minecraft BP/RP、UUID、manifest、ワールド、読み込み順、Xserver設定は変更しません。専用WebブランチとPR #1へまとめ、mainへの直接push・自動mergeは行いません。
