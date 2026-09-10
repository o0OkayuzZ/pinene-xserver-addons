# 青りんご系列の統一

旧版と現行版の同名アイテムを統一するユーザー指示に基づく変更です。Web用PRとは別の `fix/consolidate-blue-apples` ブランチで扱います。

## 変更内容

| 廃止する旧ID | 継続する現行ID |
| --- | --- |
| `myname:blue_apple` | `resetapple:blue_apple` |
| `myname:blue_diamond_apple` | `resetapple:blue_diamond_apple` |
| `myname:enchanted_blue_diamond_apple` | `resetapple:enchanted_blue_diamond_apple` |

BP15から旧アイテム定義3件と旧強化レシピ2件を削除します。BP03に同じ材料・配置・完成数の現行強化レシピがあるため、旧レシピの複製は残しません。

Dungeonsのダイヤ宝箱14件で、`myname:blue_apple`を`resetapple:blue_apple`へ置換します。報酬の重み、抽選回数、個数、その他のアイテムは変更しません。BP03の現行アイテム・効果スクリプト・レシピも変更しません。

RPの画像・翻訳キーには共用や過去の互換用データがあるため、この変更で削除しません。`.displayname_bak_*`と過去のログは実行されるアイテム定義ではなく、履歴として保全します。実行対象のJSON・JS・mcfunction・langと配布mcstructureに、廃止IDが残らないことをチェックします。

## 回帰検証

`python tools/test_blue_apple_consolidation.py` は、5定義の削除、14宝箱のID以外の完全一致、現行BP03の保全、実行対象への旧ID残存を検査します。`tools/validate.py` からも実行し、この検査に通る19ファイルだけを既存統合ベースの変更許可へ追加します。他のパック変更への保全チェックは維持します。

既存の `python tools/test_dungeons_boss_rewards.py` と `npm test` も実行対象です。検証用Python依存は `tools/mycology/requirements.txt` から作業用仮想環境へ導入します。

実行結果：統一用4テスト、Dungeons既存4テスト、`npm test`、統合静的検証が成功しました。統合検証内のMycology静的チェックは1773件成功です。ハッシュ照合を含む統合検証は、Windowsの自動改行変換を除去してGit原本のバイト列で実行しました。検証が再生成した過去のレポートと、一時的な改行調整は変更へ含めていません。

## 適用上の制限

本変更は保存済みインベントリ・チェスト・地面のアイテムを自動変換しません。既存ワールドに旧IDの在庫がある場合、削除版の導入前に上表に従って移行が必要です。現在のワールドは調査・編集していません。

UUID、manifest、読み込み順、ワールド、Xserver設定は変更しません。実ゲームでの読み込み・入手・食事効果は未検証です。PR作成までとし、mainへの直接push、merge、サーバーへの適用は行いません。Webは現行系列のみを掲載済みのため、この作業で変更しません。
