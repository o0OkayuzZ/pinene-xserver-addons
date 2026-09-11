# Dungeons 防具・召喚道具の追加

76項目を追加し、Dungeonsは250項目になりました。今回の追加は防具64部位、通常版アーティファクト6種類、製作レシピ6件です。Web全体は436項目（アイテム337・レシピ77・機能22）、461ページです。

防具はダーク、エメラルド、芸人、エヴォケーションローブ、不気味、衛兵、ヤマネコ、ピグリン、プレート、根腐れ、シュルカー、スノー、芽生え、イカ、テレポーテーションローブ、盗人の16系列を追加。合計28系列・112部位の見た目と基本設定を比較できます。

アーティファクトはエンチャントされた草、素晴らしい小麦、ハチの巣、ヴェックスを呼ぶ本、ソウルランタン、風のホルンに対応する通常版を追加しました。ゲーム内表記は個別の日本語名を使用しています。

## 変更ファイル

- `src/data/field-guide.json`：76項目と既存のアーティファクト製作紹介の件数を更新。
- `src/data/content-registry.json` / `src/data/dungeons-guide.json`：防具112部位・通常版アーティファクト14種類の紹介と一覧。
- `public/images/items/dungeons-*.png`：実際のパック内画像70枚を追加。
- `scripts/add-dungeons-companions.py`：今回の登録とソース照合。ゲーム側は読み取り専用、既存IDがあれば停止。ビルドでは実行しません。
- `tests/dungeons.spec.ts`：防具112件の展開・末尾の詳細リンク、ソウルランタンのレシピから説明への移動、ソウル必要数と不足時の説明を確認。
- README・実装記録・公開記録、Dungeonsの各幅スクリーンショット。

## ソースとの照合

根拠commit：`aea85120954a8b74033b86253c17a04b691dab21`。BP08・RP06のアイテム、日本語名、アイコン、画像、装備部位、防御値、耐久値、修理材料を照合。報酬テーブルへの正の重みの参照があるものは、確定入手ではなく抽選候補として記載しています。

アーティファクトはアイテムからカスタムコンポーネント登録・使用処理・召喚先エンティティ・製作レシピを照合。ソウルランタンは13未満で召喚せず、13以上で13を消費する分岐を確認しました。風のホルンは範囲7ブロックの有効な対象への押し返しと鈍足処理を確認し、対象ごとの成功や飛距離は断定していません。

通常版の基本クールダウンは草60秒、小麦37秒、巣50秒、ヴェックスの本90秒、ソウルランタン50秒、ホルン10秒です。装備などによる補正や実際の待ち時間は別に扱っています。ラマの最終ダメージやハチの同時数・発生間隔・存続時間は推測していません。

## 検証

依存変更なし。データ検証成功、型確認35ファイルでエラー・警告0件、production build 461ページ、公開分離テスト4件成功。390px・768px・1440pxで全436図鑑ページを巡回する24テストが成功しました。

同名の魂のランタンを区別する材料表記を調整後、データ検証・実ビルドの公開分離監査・Dungeonsの3幅テストを再実行。材料側の「魂のランタン（バニラ） × 1」、ソウル消費条件、レシピリンクも確認しました。private/draft識別データ投入時と復元後の出力監査はともに成功（479テキストファイル）。

[PC全体](artifacts/dungeons-desktop-1440.png) / [スマホ全体](artifacts/dungeons-mobile-390.png) / [タブレット全体](artifacts/dungeons-tablet-768.png)

## 確認対象URL

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/items/?content=minecraft-dungeons
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-soul-lantern-recipe/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-soul-lantern/

公開先の最終確認とcommitは[PUBLISH_REPORT.md](PUBLISH_REPORT.md)に記録します。

## 未確認事項

ゲーム内の戦闘性能・防具セット効果・召喚後の挙動・修理・製作・解放表示・入手操作は今回未検証です。材料の`minecraft:golden_dandelion`は引き続き「金色のタンポポ（仮訳）」と表示しています。参加URLは未設定、大きな紹介イラストは仮素材です。

変更はWebのみ。Minecraft BP/RP、UUID、manifest、ワールド、読み込み順、Xserver設定は変更しません。専用Webブランチと既存PR #1へまとめ、mainへの直接push・自動mergeは行いません。
