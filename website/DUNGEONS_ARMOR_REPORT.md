# Dungeons 通常防具の追加と残数監査

通常・ユニーク区分の未掲載防具84部位を追加し、限定品を除く49系列・196部位を掲載しました。Dungeonsは334項目（アイテム309・レシピ22・機能3）、Web全体は520項目（アイテム421・レシピ77・機能22）、545ページです。

## あとどれくらいあるか

根拠commit `aea85120954a8b74033b86253c17a04b691dab21`のBP08を集計しました。アイテム定義485件のうち309件を掲載し、残りは176件です。レシピは268ファイル中22ファイルを掲載項目の根拠として使用し、246ファイルが未掲載です。レシピファイル数は、追加できる独立コンテンツ数や完成品数を意味しません。

| 未掲載アイテムの区分 | 件数 |
| --- | ---: |
| 通常アーティファクト | 24 |
| レア版アーティファクト | 38 |
| 近接・遠距離武器（入手不可フォルダーを除く） | 39 |
| 鍵 | 18 |
| 絵画 | 14 |
| ルーン | 9 |
| その他アイテム | 6 |
| 限定防具・限定アーティファクト | 13 |
| 旧版互換品 | 13 |
| 入手不可フォルダーの武器 | 2 |
| 合計 | 176 |

この数は未掲載定義の棚卸しであり、全部を公開する約束ではありません。入手経路や処理の照合が必要で、同系統のレア版・旧版互換品・確認用定義も含みます。通常防具と特殊な矢のアイテム紹介は今回までで掲載済みです。Mob・ボス・地形・建築物の説明はこのアイテム／レシピ集計には含めていません。

未掲載レシピ246ファイルのフォルダー内訳は、防具88・近接武器76・遠距離武器46・アーティファクト24・ブロック8・その他4です。アイテム紹介があることと、その製作・強化レシピまで掲載済みであることは分けて数えています。

[集計JSON](artifacts/dungeons-remaining-audit.json)は`python website/scripts/audit-dungeons-remaining.py`で再集計できます。

## 変更ファイル

- `src/data/field-guide.json`：84部位の画像・部位・防御値・耐久値・修理材料・確認できた報酬候補。
- `src/data/content-registry.json` / `src/data/dungeons-guide.json`：49系列196部位の紹介と一覧。
- `public/images/items/dungeons-*.png`：実際のパック内画像84枚。
- `scripts/complete-dungeons-armor.py` / `scripts/audit-dungeons-remaining.py`：Web登録と残数照合。
- `tests/dungeons.spec.ts`：196件への展開と、最後の深緑系列の脚装備への移動。
- README・実装記録・公開記録、スクリーンショットと集計JSON。

ゲーム側は読み取り専用です。アイテム、日本語名、画像アトラス、装備部位・基本数値と修理材料を照合しました。報酬テーブルの正の重みの参照がある場合だけ抽選候補と記載。防具の名前から固有能力やセット効果を推測していません。

## 検証と画面

依存変更なし。データ検証成功、型確認35ファイルでエラー・警告0件、production build 545ページ、公開分離テスト4件成功。390px・768px・1440pxのChromiumで全520図鑑ページを巡回する24テストが成功しました。防具196件の一覧展開・最後の装備へのリンクも確認しています。

private/draft識別データを投入した実ビルドと復元後ビルドの出力監査が成功。Dungeons334項目が重複なく種類別一覧へ入ること、根拠ファイルの存在も照合しました。ゲーム側ファイルは根拠commitから変更していません。

[PC全体](artifacts/dungeons-desktop-1440.png) / [スマホ全体](artifacts/dungeons-mobile-390.png) / [タブレット全体](artifacts/dungeons-tablet-768.png)

## 確認対象URL

- https://o0okayuzz.github.io/pinene-xserver-addons/contents/minecraft-dungeons/
- https://o0okayuzz.github.io/pinene-xserver-addons/database/items/?content=minecraft-dungeons
- https://o0okayuzz.github.io/pinene-xserver-addons/database/entries/dungeons-verdant-leggings/

上記3URLを公開先で390px・1440px確認済みです。HTTP 200、画像、一覧展開、最後の装備への移動、横はみ出しとJavaScriptエラーがないことを確認しました。実装commitは`61a37b74`、公開生成物は`7234c24`。配置記録は[PUBLISH_REPORT.md](PUBLISH_REPORT.md)にあります。

ゲーム内の戦闘・セット効果・修理・実際の入手操作は今回未検証です。参加URLは未設定、大きな紹介イラストは仮素材です。Web以外のゲームパック、UUID、manifest、ワールド、読み込み順、Xserver設定は変更しません。専用Webブランチ・PR #1を更新し、mainへの直接push・自動mergeは行いません。
