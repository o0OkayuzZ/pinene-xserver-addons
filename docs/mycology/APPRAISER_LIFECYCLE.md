# 鑑定士ライフサイクル修正・検証報告

2026-09-23。基準はfetchした `o0OkayuzZ/pinene-xserver-addons/main` の **`0f7d5acf6b1169e22eb71160a52b1d3febda674b`**。
作業ツリーは `C:/Users/はーにゃ。/pinene-appraiser-work`。既存の別作業ツリーの未コミット変更を避け、detached worktreeで実装した。commit / push / PR / Xserver deployは実施していない。

## 監査結果と変更

mainではnameable欠落、死亡報酬が赤・茶だけ、単一world leaseと単一期限timer、自然個体生存中のspawn抑止、名札永久化の欠落を確認した。
また、leaseと一致しない旧token個体の無条件removeと、実際に死亡しても期限＋猶予後なら報酬を出さない旧分岐があった。

- 15分のactive overworld minuteカウント、通常4%・島20%、通常30分・島45分、UI猶予最大5分、24–48ブロックを維持。
- 世界最大1体の分岐を撤廃。次の抽選が成功すればA生存中でもBを追加し、それぞれの期限を管理する。
- 1抽選最大1体、安全な地表・隣接足場、全プレイヤーとの最小距離、最大16回の場所探索、島プレイヤー優先、spectator除外、オフライン中のspawn追いつき禁止は維持。
- 自然死亡は赤・茶・深紅・歪んだを各64個。名札永久個体も同じ報酬。管理summon・卵等は特殊報酬なし。
- `minecraft:nameable`を追加。名札保持中はJSONのtrade interactionを除外し、Script側も消費前の名札を検出してUIを開かない。
- 寿命退場は`remove()`。距離だけでは退場させない。

鑑定・図鑑・登録簿・効果・レアリティ・テクスチャは変更していない。既存35種＋NF-001〜100、4入力系統、将来ID拡張、個人別発見、未発見秘匿、1〜64個鑑定の既存テストも継続実行した。

## 保存とtimer

Entity Dynamic Propertyの新キー **`pinene:myco_appraiser_state_v2`** にJSONを保存する。

| フィールド | 内容 |
|---|---|
| version | 2 |
| naturalOrigin | 自然出現由来。命名後もtrue |
| spawnedAt | 出現時刻（Unixミリ秒） |
| expiresAt | 個体ごとの期限。永久化後はnull |
| island | 島由来か |
| permanent | 命名による永久化。一度trueなら改名・名前消去でも保持 |
| deathClaimed | 死亡出力の重複防止 |
| retired | 寿命removeを死亡報酬から除外 |
| migration | 旧個体のみ。lease-v1 / orphan-v1 |

自然spawn時にv2状態を保存し、旧`pinene:myco_natural_token`も維持する。非自然個体にこれらの状態は付けない。
JSの`Map<EntityId, timerId>`は期限までの一回のwake-up用であり、永続情報ではない。期限前の起床では残り時間を再計算する。UI使用中だけ10秒以下の間隔で再確認し、元の期限＋5分を越えない。
死亡・remove/アンロード・永久化で該当個体のtimerを解除する。他個体のtimerには触れない。

起動時に各ディメンションのロード済み鑑定士だけを一度列挙し、その後は`entityLoad`と個体timerで処理する。全tick走査や常時全ディメンション検索はない。
アンロード中に期限を迎えた未永久個体は、ロード時にremoveする。未来期限は残り時間で再登録、永久個体は期限処理対象外。破損v2データは上書き・削除せず記録し、他個体の起動処理を継続する。

## 名札・死亡報酬

`playerInteractWithEntity`の`beforeItemStack`を優先して名札を識別する。最後の1枚が消費済みで`itemStack`が空でもUIを先に開かない。ネイティブの命名・消費処理はBedrockに任せる。
次の実行機会に実際の`entity.nameTag`を確認し、命名されていればpermanent=true・expiresAt=nullに保存してtimerを解除する。名札を持ってクリックしただけでは永久化しない。
ロード時・期限処理時にも実名を確認するため、ネイティブ命名直後に再起動しても永久化を復元できる。命令や別Scriptで実名が付いた自然個体も同じ保護を受ける。

永久化はnaturalOriginと旧tokenを消さない。死亡時は自然由来、未退場、未出力を確認し、deathClaimedを保存してから4種の`ItemStack(type,64)`を各1回生成する。Looting依存処理やエンティティloot tableは追加していない。実際の死亡は、期限callbackがまだ実行されていなくても報酬対象とする。
既にremoveした個体はretired=trueなので、仮に追加死亡通知が来ても報酬を出さない。

API根拠はMicrosoftの[名前コンポーネント](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitycomponents/minecraftcomponent_nameable?view=minecraft-bedrock-stable)、[操作前後のItemStack](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/playerinteractwithentityafterevent?view=minecraft-bedrock-stable)、[装備フィルター](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/filters/has_equipment?view=minecraft-bedrock-stable)。公式`@minecraft/server 2.7.0`型定義でも検査した。Windows実機で最後の名札の消費前後とUI抑止も確認した（下記）。

## 旧データmigration

新しい意味で旧キーを再利用しない。v2未保存の旧token個体だけ、初回アクセスで一度移行する。

- 旧leaseのentityId・tokenが一致し、期限が数値なら元の期限・島情報を移す。出現時刻は期限−元の寿命から復元する。
- 旧leaseは読み取り用の移行資料としてそのまま残す。まだアンロード中の旧個体がいても、新規spawnや他個体死亡で失われない。新spawnの抑止には使わない。
- lease欠落・不一致・破損で元の期限を確定できない旧token個体には、初回移行時から**一度だけ45分**の保護滞在を与える。spawnedAtとislandは不明としてnullを保存し、推測した過去時刻や地域を事実として記録しない。v2保存後の再起動で期限は延長しない。命名済みなら永久化する。
- 既知の期限が過去の未命名個体は通常の期限処理に従う。旧tokenだけを理由にstaleとして一括削除しない。
- `pinene:myco_spawn_minutes_v1`は従来通り使用し、移行時に初期化しない。

## 変更ファイル

配信用BP `behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/` と、対応するauthoring側 `tools/mycology/pack/BP/` の両方で次の4ファイルを変更。両者のバイト一致を自動テストする。

- `entities/mushroom_appraiser.json`
- `scripts/mycology/config.js`
- `scripts/mycology/index.js`
- `scripts/mycology/npc.js`

テスト・文書・実行設定:

- `tools/mycology/tests/npc.test.mjs`（新規29テスト）
- `tools/mycology/tests/adapters.test.mjs`（4種報酬、v2期限、移行後remove、spawn状態の検証へ更新）
- `tools/mycology/tests/mock-minecraft.mjs`（entityRemove通知）
- `tools/mycology/tests/engine-smoke.js`（実機用の4種報酬・旧lease移行・v2永久/未永久fixture。今回は未実行）
- `tools/mycology/tests/appraiser-engine.js`・`prepare_appraiser_world.py`（今回実行した隔離クライアント試験とワールド作成）
- `tools/mycology/package.json`、`tools/mycology/tools/validate.py`（新テストを既存一括検証へ追加）
- `tools/mycology/docs/ACCEPTANCE_TESTS.md`（実機項目を正式仕様へ更新）
- `tools/mycology/data/validation.json`、`tools/mycology/docs/TEST_OUTPUT.txt`、`tools/mycology/docs/VALIDATION_REPORT.md`（再生成した結果）
- 本報告と`docs/mycology/appraiser-validation/`の全体・基準main比較ログ。

既存テストは削除していない。旧「赤茶のみ」「lease不一致なら無条件削除」の期待値は、今回の指定に合わせて4種報酬と期限の判明した移行個体のremoveへ置換し、孤立旧tokenの保護と永久個体の維持を新規テストで追加した。無関係の失敗を通すための除外・期待値緩和はしていない。

## 自動検証結果

| 検証 | 結果 |
|---|---|
| Mycology全テスト | **109件成功**（新規29＋既存80） |
| Mycology静的validator | **2,268アサーション成功** |
| 公式API型検査 | 成功（server 2.7.0 / server-ui 2.0.0） |
| Golden Foods | 45件成功 |
| Grave policy / GF release | 12件成功 |
| Bomb / Sniper crossbow | 15件成功 |
| Pinenite | 64件成功・5件失敗。変更前mainでも同じ5件が失敗 |
| Infinite Castle | 115件成功（npm testが前段で停止するため個別実行） |
| 全体合計 | **360件成功・5件失敗** |
| ルート統合validator | egbread.jsonの過去releaseハッシュ照合で停止。変更前mainでも同じ失敗 |

全体テストの既存失敗は、entity ownershipの過去差分制約、旧パスのblue diamond recipe欠落、figure pickupの旧helper名期待、Zombie Gear/Crossbowの過去差分制約、parcanite_sword.png欠落の5件。
比較用worktree `C:/Users/はーにゃ。/pinene-appraiser-baseline` は同じSHAで作成した。Pineniteの両失敗集合と64/5の結果を確認した。

新テストは依頼の30確認項目を、spawn境界・独立期限・UI猶予・4種死亡・名札/UI・restart/loadのケースにまとめて網羅する。さらに遅延callback前の実死亡、ネイティブ命名とJS保存の間のrestart、孤立旧token、破損データ隔離、重複loadのtimer一意性、実行中の全体検索禁止、配信用BP一致を確認した。

## 実機確認と限界

2026-09-23、Windows Minecraft Bedrock **26.51**の隔離したローカルワールドで実施。元の利用中ワールドのDBは複製・変更せず、別UUIDのMycology BP/RPだけを有効化した。クライアントはserver 2.7.0を2.10.0、server-ui 2.0.0を2.2.0として実行している。これはXserver上での検証ではない。

確認済み：実際のspawn処理でA/B共存と永久A存在中の追加spawn、未命名・永久自然個体の実死亡4種各64、管理summon死亡0、独立期限とremove時0、既存UIセッションの猶予と5分上限、一致旧lease移行と4種報酬、孤立旧tokenの一度限り移行と永久化。

サバイバルで名前入り名札1枚を実際に右クリックして消費し、実名・permanent・naturalOrigin・期限null・UI非表示を確認。その後の素手右クリックでは鑑定フォームが開いた。Minecraftアプリを完全終了して再起動し、同じ命名個体と未来期限の保存値が維持され、停止中に期限を過ぎた個体だけが報酬なしで消えることも確認した。

最後に、その同じネイティブ命名個体を再起動・遠方移動後に死亡させ、**赤・茶・深紅・歪んだきのこ各64個、ちょうど4スタック**を再確認した。最終集計は**12ケース中11成功、アンロード成立確認1件未合格**。ケースごとの最終結果と全試行履歴は[engine-results.json](appraiser-validation/engine-results.json)、最終実行ログは[engine-final-run.txt](appraiser-validation/engine-final-run.txt)。試験中に製品コードの追加修正は必要なかった。

生ログは`appraiser-validation/engine-*-run.txt`、操作画像は`native-name.png`・`named-appraisal-ui.png`・`spawn-result.png`。`engine-code-hashes.json`に実機でロードした4ファイルと製品コードの一致検証を保存した。初期試験の失敗ログも残している。最初の生成失敗は試験地表が丸石だったためで、草の安全な足場を用意すると製品コードを変更せず成功した。遠方移動の初回試験では退避先の足場不足、続く試験では元チャンクのアンロードを証明できなかったため、成功には数えていない。

実機fixtureは死亡を`Entity.kill()`で発生させ、短い絶対期限と猶予境界を設定した。設定値15分・4%/20%・30分/45分・最大5分は変更していない。実時間30分/45分の待機、島の実地形と抽選分布、Looting・プレイヤー攻撃・環境ダメージの全経路、金床そのもの、改名・タッチ・コントローラー、Xserver固有動作、既存ワールド全体の受入試験は未実施。`ACCEPTANCE_TESTS.md`の複合項目は一部確認だけでは完了にしない。

**実チャンクアンロード試験は未合格。** 5000ブロックへの移動とネザーへの移動をそれぞれ試したが、120秒の試験期限前に対象3個体の`entityRemove`通知を確認できなかった。復帰時に永久個体・未来期限個体が残り、期限切れ個体が報酬なしで消えるという状態の確認は通ったが、アンロード中の期限経過を実証したとは扱わない。製品処理の不具合とは特定できておらず、サーバー側で確実にチャンクが退出する条件の検証が残る。mockでのload/removeと、実アプリ終了からの復元は別途成功している。

### 実機試験の再現

Pythonの`nbtlib`を用意し、`python tools/mycology/tests/prepare_appraiser_world.py --template-world <既存ワールド> --output <新しい空のパス>`で作成する。テンプレートから読むのはlevel.datのみ。出力先が既存なら中止する。新規ワールドをクライアントのminecraftWorldsへ配置して起動すると自動試験後に名札操作待ちになる。

1. 名札を右クリックし、`/scriptevent appraiser_test:inspect`。次に素手で鑑定フォームを確認する。
2. `/scriptevent appraiser_test:restart`後、5秒以内に保存終了し、アプリも終了。再起動で自動的に永続状態を検証する。
3. `/scriptevent appraiser_test:unload`で退出通知と期限経過後の復帰を検証する。通知が確認できなければ失敗として記録する。
4. `/scriptevent appraiser_test:death`で命名した同一個体の4スタックを検証する。`status`で全履歴を表示する。

`tests/appraiser-engine.js`はテストワールドだけにコピーされる。コピー側npc.jsには実装本体を変えずprivate spawn関数のexportを末尾に追加し、コピー側main.jsからharnessをimportする。製品パックにはそのexport/importもfixtureも含めない。ContentLogはアプリ終了後に取得する。自動validatorの`bedrockEngineExecuted:false`はそのコマンド単体の実行範囲であり、本節の手動実機結果とは別である。

死亡アイテム生成はBedrockの複数API呼び出しであり、サーバークラッシュやspawnItem例外に対する4スタック一括トランザクションではない。重複通知による二重報酬を防ぐため出力前にclaimする。通常イベント経路と重複通知は自動テスト済み。
