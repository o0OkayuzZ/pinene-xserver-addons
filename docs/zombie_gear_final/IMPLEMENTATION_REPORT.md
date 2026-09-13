# Zombie Gear FINAL 実装・検証報告

2026-09-13。`CODEX_START_HERE.md`、FINAL仕様、承認済み参照画像に基づく実装。
元ZIPは `ZombieGear_Codex_Handoff_FINAL_20260913.zip`。引き継ぎ資料は `handoff/` に保存。

## 実装先と成果物

- Repository: `o0OkayuzZ/pinene-xserver-addons`
- 基準: `08b41ef55689c1dce2f5119f10ecbb1294f18812`。終了前にもfetchし、origin/mainが同じHEADであることを確認。
- 作業ブランチ: `implement/zombie-gear-final`。ローカル作業先は `Downloads/zg-final-repo`。
- BP/RP: 既存UUID・20 item IDを維持し、両方を1.2.0へ更新。ルートと同梱ワールドのpack登録バージョンも同期。
- ローカル実装と配布ファイルの作成まで。GitHubへのpush、本番サーバーへの配置は行っていない。
- 他作業とのMinecraft操作競合中は一時停止し、ユーザーから終了の連絡を受けて再開。検証専用ワールドで最終テストを完走した。

## 主な変更

1. 20アイコンをPythonで32×32 RGBAの透過ピクセルアートとして作成。全て正面、チェストだけ正面右側＝プレイヤー左肩に目玉。C0の緑からC4の赤・露出骨へ変化。
2. 20装着モデル・テクスチャを更新。左肩の目玉はleftArm配下。128×128の装着テクスチャとUV余白を使用。1セット16キューブに整理。
3. 混在セットの実効Cを最低Cへ統一。防御2/4/4/1、攻撃倍率1/1.1/1.3/1.7/2.5、ストック上限4−C。
4. 蘇生と幹細胞による浄化の成功時だけ4部位を同じCへ変換。耐久・エンチャント・名前・Lore・ロック・動的プロパティ等をコピー。失敗時は元の4部位へ戻し、資源を消費しない。
5. 8秒チャージは毎tickで完了判定。持ち替え、しゃがみ解除、装備変更、実際の攻撃者を伴う戦闘で中断。環境ダメージだけでは20秒の戦闘ロックを更新しない。
6. HP80、外部Strength +1、外部Health Boostの保存/復元、食事制限を分離したモジュールへ移動。Health Boostは装備中に保持情報へ退避し、HP80はnative health componentで設定。
7. KB耐性は装備単位の加算を廃止。実効Cに応じてnative player component groupを1つ選び、蘇生後60tickは耐性1。通常ダメージをcancelしてHPを手動減算する旧回復処理を廃止。
8. 致死経路は死亡成立前のcancelと遅延再確認を使用。死亡済みEntityでストックを消費するfallbackを削除。

## 実機で発見・対応した差異

Windows Bedrock 1.26.4501.0、ゲーム表示v26.45で検証。宣言した`@minecraft/server` 2.6.0はエンジン上で2.9.0へ昇格して実行された。

- `beforeEvents.entityHurt`のHPは、ダメージを仮適用した値だった。仮適用前HPを戻して致死判定し、Absorptionのnative処理を保持した。
- 新規プレイヤーの`scoreboardIdentity`が未生成の場合があったため、scoreboard APIへPlayer Entityを渡す方式へ修正。
- effectAddは既存効果の更新では発火しない場合がある。Strengthを毎tick確認して外部上書きを保存する方式を追加。
- effectAdd beforeの`effectType`が日本語表示名だった。ID形式に加え、日本語・英語表示名とレベル接尾辞に対応。amplifierはbeforeイベントから推測していない。
- 削除したEffectのafterイベントが後で届き、プロパティ参照が例外になる場合があった。削除済みEffectを無視するガードを追加し、回帰テストと実機再実行で解消を確認。
- native component groupを除去するだけではKB値が残ったため、脱装備時はKB0とHP20を明示的に設定。実機でも脱装備後の移動量とHP20を確認。
- 腐肉のnative栄養加算とitemCompleteUseの実行順がtick境界をまたいだため、完了イベントと1tickの猶予でnative加算を保持。食事未完了なら保留した増加を戻す。

## 検証結果

| 対象 | 結果・根拠 |
|---|---|
| 47件のゲーム処理回帰テスト | 合格。`node tools/zombie_gear_v4/test_gameplay.cjs`。API mockであり実機の代用と断定しない |
| 126 JSON、20 ID、20アイコン、20装着モデル | 合格。`validate_assets.py`。32×32/RGBA/二値alpha、目玉側、UV参照、防御、enchantable、日本語名、UUID/登録バージョン等 |
| Script API型検査 | 合格。TypeScript checkJs、`@minecraft/server` 2.6.0型定義 |
| 差分形式 | `git diff --check`合格 |
| HP80・防御合計11 | 実機合格 |
| 致死→C1/stock3/HP40 | 実機合格 |
| C0/4→C1/3→C2/2→C3/1→C4/0、5回目拒否 | 実機合格。後半はテスト用の蘇生関数呼出しも使用 |
| C4/0→C3/1→C2/2→C1/3→C0/4 | 実際に幹細胞を持ち、しゃがみ操作で全遷移を確認。スクリーンショット4枚を保存 |
| チャージ中のしゃがみ解除 | 実操作で中断・未消費を確認 |
| 8秒境界、C0補充、持ち替え/戦闘中断、失敗rollback、metadata保持 | mock合格 |
| C4/C4/C4/C1の実効C1、stock3 clamp | 実機合格 |
| 蘇生直後のAbsorption、低HP＋Absorptionの誤蘇生防止 | 実機合格。native HPが守られ、ストック未消費 |
| Strength II→装備中III→脱装備後II | 実機合格 |
| 外部Health Boost amp14、装備中に追加したamp2の復元 | 実機合格 |
| 即時回復・再生能力禁止 | 日本語環境で実機合格 |
| 目玉位置とC0〜C4の装着表示 | 実機正面とアセット描画で確認。体型については下記制約あり |
| 通常食、腐肉、cake、修理10% | mock・実機合格。リンゴとcakeは満腹度/Saturation不変、腐肉は満腹度＋4・HP＋8、頭防具の損耗100→89（最大110の10%修理） |
| KB 0.40/0.56/0.72/0.88/1.00と混在C1 | 実際のゾンビAI攻撃に対する初動の移動量を裸と比較して合格。実測0.400000/0.560000/0.720000/0.880019/0.999997、混在C1=0.560000 |
| 一人称非表示・エンチャントglint | 一人称での遮蔽なし。装備画面の4部位アイコンと装着モデルに光沢を実機確認し画像を保存 |

保存した`engine-smoke.log`は最後の検証専用ワールドのロード開始から終了までを抽出したもの。**44 assertion合格、失敗0、エラー0**。途中の試行で見つけた問題は上記のとおり修正して再検証した。

## 互換性・検証範囲

- `applyDamage`だけではノックバックの比較に使えなかったため、最終結果は実際のゾンビAI攻撃による計測を使用。別の攻撃手段や複数人の同時戦闘を全組合せで計測したものではない。
- 実機の食事確認はリンゴ・腐肉・cake。通常食全種類の個別試食はしていないが、制限処理はitem IDを列挙せず栄養値の増加を共通で処理している。
- 利用中の大きなニワトリ型Personaスキンでは、一部の胴・頭モデルがスキン側に隠れることを確認。標準プレイヤー寸法で作成しており、特殊体型全てへの追従は保証しない。
- native HP/KBのため`minecraft:player`を定義する。リポジトリ内に同IDの別定義がないことを確認し、Mojang vanillaの元component/eventを保持した。同IDを上書きする追加パックが増えた場合は、その定義へ今回の名前空間付きgroup/eventを統合する必要がある。
- 回復禁止の表示名対応は日本語・英語とID形式。別言語のホストで表示名が返る場合は、その言語名の対応と実機確認が必要。
- 外部Strengthはエンジンが受理した実値を保存する。エンジン自体が無視した弱い上書きや、同一tickの同値・同時間上書きはAPIから区別できない。
- 4/8人同時装着のFPS測定、全エンチャント・全併用アドオンとの実戦組合せは未測定。

## 再現・追加検証

画像再生成はPython＋Pillowで`build_final_assets.py`、モデル一覧は`render_final_models.py`。
`build_native_knockback.py`は同梱の固定vanilla player JSONからHP/KB groupを生成する。
`finalize_pack.py`は同梱handoffから名称とバージョン登録を生成する。

実機は他作業がMinecraftを使用していない時に実施する。既存の`Zombie Gear FINAL isolated validation`ワールドを閉じてから`update_engine_test.py`でテストBPだけ更新する。ゲーム一覧では**ワールド名を目視して選択**し、固定回数のキー入力だけで選ばない。

新規検証ワールドは`prepare_engine_world.py --template-world <平坦ワールドのフォルダ>`で作成できる（Python＋nbtlib）。元ワールドのlevel.datを読み、新しいDBのワールドを作る。テスト専用UUID・幹細胞ダミー定義・自動テストは配布BP/RPには含まない。

## 参照

- [Mojang vanilla player v1.26.40.05](https://github.com/Mojang/bedrock-samples/blob/v1.26.40.05/behavior_pack/entities/player.json)
- [EffectAddBeforeEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/effectaddbeforeevent?view=minecraft-bedrock-stable)
- [EntityHurtBeforeEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtbeforeevent?view=minecraft-bedrock-stable)

上記API資料に加え、イベントのタイミングやローカライズについては本報告の実機観測を根拠としている。
