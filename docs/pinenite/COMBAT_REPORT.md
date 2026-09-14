# Pinenite Combat FINAL v1.0 実装・検証報告

## 状態

ローカル実装と自動テストを追加済み。**Bedrock実機の受け入れ検証は未完了**。
防御41の実効値、エンジンの軽減前ダメージ取得、跳躍距離、発光の実描画は、下記の実機手順で確認する必要がある。
未確認の値を補正する独自の防御計算や、仕様外の追加軽減は導入していない。

- 対象: `o0OkayuzZ/pinene-xserver-addons`
- 調査したmain: `08b41ef55689c1dce2f5119f10ecbb1294f18812`（2026-09-13取得、作業後もremote mainが同一であることを確認）
- ブランチ: `codex/pinenite-combat-final`
- 作業場所: `C:/Users/はーにゃ。/Downloads/pinenite-combat-final`
- 実装仕様: `C:/Users/はーにゃ。/Downloads/Pinenite_Combat_Spec_FINAL_v1.0.md`
- 本番サーバー、既存開発パック、プレイ中のワールドへのコピー・デプロイは行っていない。

## mainの先行調査

PineniteはDeathnerite BP内の4アイテムと、RP内の専用attachable・geometry・PNGで構成されていた。
既存Pineniteは防御0、耐久・エンチャント・固有戦闘能力のない外観装備だった。
Parcaniteのarmor JSONには耐火、耐久、エンチャント、トリムタグ、部位別状態異常除去、Anti-Knockbackコンポーネントが存在した。
既存の`components/Armor`実装を利用し、その共通コードには変更を加えていない。

Deathnerite BPは`@minecraft/server 2.0.0`。キャンセル・倍率変更に必要な`entityHurtBeforeEvent`は安定版2.6.0で利用可能なので依存を2.6.0へ更新した。
同じmainのZombie Gearが既に2.6.0／Bedrock 26.40を利用している。
26.40には致死ダメージに対するbefore-event変更の修正が含まれるため、Deathnerite BPの最低エンジンも1.26.40にした。
パックUUIDとheader/module versionは維持。今回の成果物は更新配布用のバージョン採番を行う前のローカル差分。

## 各能力

| 項目 | 実装 |
|---|---|
| 防御 | 既存4アイテムのwearable.protectionを8/14/11/8に設定。独自の上限回避や追加軽減なし |
| 最大HP | Health Boostのamplifier 0/1/2/4により+4/+8/+12/+20。装備数を毎tick確認。Global Player JSONなし |
| Parcanite継承 | 各部位から全基本コンポーネントを継承し、PineniteのID・アイコン・表示名・スロットを維持 |
| 捕食解析 | プレイヤー本人をdamageSourceに持つentityAttack/projectileのみ。2/4/6回目から1.10/1.20/1.30。元のHitを直接変更し、追撃用Synthetic Damageは生成しない |
| 適応外殻 | プレイヤー別・対象Entity ID別Map。初回記録、2/3/4回目に10/20/30%。学習間隔15tick。CT中も現在段階による軽減は適用 |
| 記憶 | 最後の有効な戦闘から800/1000/1200tickで段階低下・消失。共生中は減衰停止 |
| 再生 | Pinenite防御変更前のimmutableなoriginalDamageから25%または35%を予約。各予約の総量/120を毎tick消費。共生中かつHP50%以下なら総量/60。既存予約も加速。上限なし、毎tickの余剰分は消滅 |
| 寄生跳躍 | Jump押下＋スニーク＋接地。水平視線方向へネイティブImpulse、CT140tick。テレポート・無敵・落下ダメージ取消なし。水平Impulseは0.6、距離は実機調整待ち |
| 完全寄生 | 4部位一致で成立。追加の常時攻撃・防御倍率なし |
| 完全共生 | 同一Entity IDで解析III・適応III・4部位が揃うと成立。期限300tick。有効攻撃・帰属がある有効被弾のみ更新。対象数・種類数の制限なし |
| 適応反射 | 既存共生対象の被弾でrandom < 0.1。incomingをキャンセルし、originalDamageを次の書込み可能なタイミングでoverrideとして反射。予約なし |
| 適応フレーム | getAABBの辺を専用#39c5bbパーティクルで追従。Iは薄く断続、IIはほぼ連続、IIIは連続。共生は30tick周期の同期脈動。描画距離64まで、記憶数には制限しない |
| 装備発光 | 元geometry/PNGはそのまま。既存ラベルのcore/crystalに限定した追加geometryを同じUVで描画。専用playAnimationチャンネルが輝度変数を送る。対象数による加算なし。最後の共生解除後10tickでFade |
| 反射演出 | 対象へ18粒の#39c5bbバースト、フレーム強調、装備の発光を4tick MAX |

通常の有効Hitはafter-eventの正のダメージを確認してから記憶・予約を確定する。
致死Hit後は再生を予約せず、蘇生は行わない。死亡・退出・無効対象を掃除し、ディメンション移動で戦闘記憶をクリアする。
装備を外すと該当部位の記憶／再生予約をクリアし、4部位を欠いた共生は解除する。
状態はセッション内Mapであり、サーバー再起動や再ログインをまたいで保存しない。

捕食解析の対象は直接攻撃に限定する一方、被弾側では攻撃者が記録されたBossの爆発・magicも適応対象にする。
DOT・環境由来の被弾は通常再生の対象になり得るが、解析・適応・共生更新には使わない。

## 元ダメージ・反射ガード

`originalDamage = ev.damage * 攻撃者の解析倍率`を、適応倍率を適用する**前**に一度だけ保存する。
この値で再生・反射を計算する。例えば入力20、適応30%なら処理に渡すダメージ14、通常予約5になる。
共生中の入力30が反射した場合は入力Hitをキャンセルし、反射30、予約0になる。

反射は`EntityDamageCause.override`、damagingEntityなしで生成する。
同期呼出し中は深さガード、遅延配信時は原因と攻撃者なしの組合せで、before/after両方の全Pinenite処理を除外する。
同じtickの通常攻撃を一括で無効化する方式ではない。両プレイヤーがフルセットの相互反射でも再帰しないことをモックで検証した。
保守的な識別のため、他アドオンの「攻撃者なしoverride」もPineniteの学習・再生から除外される。

**エンジン軽減前の保証は未検証。** 公式のEntityHurtBeforeEvent.damage説明はdamageが「防具・Resistanceより前か後か」を規定していない。
Pinenite適応前という保証と、エンジン軽減前という保証は分ける必要がある。後者は現時点で合格扱いにしていない。
もし実機でbefore値が既に軽減後だった場合、このAPI値だけでは仕様の元ダメージを正確に復元できない。
その場合は攻撃元からraw値を受け渡す方式などの設計が必要であり、逆算や実ダメージ基準への置換は勝手に行わない。
また、他パックが同じbefore-eventを後から変更・キャンセルする場合の購読順とHit対応付けは、混在環境で確認が必要。

## 自動検証

- `npm test`: 既存101件とPinenite39件、計140件すべて成功（exit 0）。
- `npm run test:pinenite`: ルール、イベント接続モック、資産・差分保存の検証。
- `python -X utf8 tools/validate_pinenite.py`: 154項目の静的資産検証に成功。Pillowが必要。既存登録不整合7件は警告として別記。
- `@minecraft/server 2.6.0`のローカル公式型定義に対するTypeScript `allowJs/checkJs/noEmit`: 成功（exit 0）。
- `git -c core.whitespace=cr-at-eol diff --cached --check`: 成功。既存ファイルのCRLFを維持して検査。

結果の全文は`combat_tests.txt`、資産検証結果は`combat_validation.json`に記録する。
NodeモックはBedrockの物理・防具計算・Molang描画を再現していない。

旧Pinenite検証器は「防御0・固有Scriptなし・33パック・古い統合時点以降の全差分禁止」を前提にしていたため、今回の仕様と調査したmain（35パック）に合わせた。
新たに、現mainの他装備／スクリプト／描画／登録ファイルの保存を検査する。既存不整合を成功扱いで隠すことはせず、次の警告をJSONに出力する。

## mainに既存の登録不整合

rootのworld registrationに7件のバージョン不一致または欠落UUID参照が存在する。
Pineniteを含むRP `ab296f68-bb16-4ede-a49c-d0ed99b5b87b`も登録2.0.4、manifest 2.0.6の不一致がある。
これらの登録ファイルはmainと同一であることを検証した。新規テストワールドでは現在のパックをUIから選択するか、実際のmanifestのUUID/versionを使うこと。
今回の差分は無関係なアドオンや既存ワールドの登録修復を含めていない。

## Content Log

今回のコードを読み込んだ新規Bedrockセッションは実行していないため、**今回のContent Logがエラーなしとは判定していない**。
既存のクライアントログ`ContentLog2026-09-13_13-31-42_1.txt`を読み取り、次を確認した。

- `ReferenceError: 'safeHasTag' is not defined`（ピネン統合ビヘイビアーパック、main.js:1185）
- `can't find animation riding.body`
- `[ic-phase1] ... chunk currently loaded and ticking`警告
- `No sound found for block type 'normal'`

これは今回の変更を入れる前の別セッションのログであり、今回のPineniteコードに起因するものとは扱わない。
Pinenite自身の実行時エラーは`[Pinenite]`で種類ごとに一度だけ出力する。

## 実機受け入れ手順

1. Bedrock 26.40以降の使い捨てワールドで、現在のDeathnerite BPと対応RP・既存依存パックを有効にし、Content Logをオンにする。
2. `/function pinenite/give_set`で4部位を入手。ID、元モデル、テクスチャ、頭・腕・脚追従、一人称／三人称を確認する。
3. 未エンチャント・Resistanceなしで、防具なし、Helmet単品、Chest単品、Leggings単品、Boots単品、Pinenite4部位、Parcanite4部位、通常防具20相当を比較する。
4. 各条件で`/scriptevent true_dn:pinenite_probe helmet`などのラベルを設定し、十分なHPと無敵時間の間隔を確保して`/damage @s 20 entity_attack`を与える。入力20とログのbefore/after、HP差を記録する。コマンドの攻撃者なしにより、この基礎計測で適応は進まない。再生開始前のafter-eventを比較する。
5. 同じ試験をResistanceありで繰り返す。before値が入力20と同じか、armor／Resistanceで変わるかを判定する。
6. **防御値の合格条件:** 8/14/11/8各単品が有効であることを確認し、20・32・41の実測比較でエンジン上限の有無を特定する。32と41が同じ実効軽減なら「Parcaniteより明確な基礎防御上位」は成立しないため、その結果を報告して仕様調整の判断を受ける。値を勝手に引き下げたり、補償軽減を追加したりしない。
7. 同一Mobへの2/4/6有効Hitと、15tick以上離した1/2/3/4被弾を確認する。同型別Entityと別プレイヤーの状態が混ざらないこと、DOT・反射で進まないことを確認する。
8. 共生後に戦闘を止めて15秒で解除、近くにいるだけで更新しないことを確認。戦闘再開時の更新、40/50/60秒の通常減衰も計測する。
9. 反射で自分のHP差0、相手への元ダメージ分、再生予約なしを確認する。相手側の防具／Resistance付きでも反射の最終量を測定する。両者フルセットを含め、ログに再帰連鎖がないことを確認する。
10. 再生6秒、共生・HP半分以下で3秒ペース、HPが半分を超える際の減速、Overheal消滅、致死Hitで蘇生しないことを計測する。
11. 1〜4部位の最大HP24/28/32/40、着脱、死亡・再ログイン、部位別状態異常除去、Anti-Knockback、耐久・エンチャント・トリムを確認する。Health Boostは他のHealth Boostと加算できないため、外部の強い効果があると「その効果にさらに+HP」にはならない。外部効果との競合は別途確認する。
12. スニーク＋ジャンプをキーボード／コントローラ／タッチで試す。Jump after-eventの接地判定が入力を受け付けること、平地で約4ブロック、壁衝突、足場の端、空中連打、7秒CT、落下ダメージ継続を確認する。距離と入力受付は未調整の実機ゲート。
13. 大小・移動・姿勢変更するMobでBounding Boxフレームを確認する。解析のみでは出ないこと、I/II/IIIの差、共生の対象と装備の1.5秒脈動、0.5秒Fade、反射バーストを確認する。playAnimationの変数がattachableへ伝わること、途中参加クライアント、通常描画／Vibrant Visualsも確認する。
14. `/scriptevent true_dn:pinenite_probe off`で観測を停止する。指定しなくても60秒で止まる。新規ログの`[Pinenite]`、Molang、Material、Particle、Script APIのエラーを採取する。

防御値の公的説明は[Wearable](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/itemreference/examples/itemcomponents/minecraft_wearable?view=minecraft-bedrock-stable)、damageの公開契約は[EntityHurtBeforeEvent](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtbeforeevent?view=minecraft-bedrock-stable)を参照した。
前者にはカスタム防御の合計上限が記載されておらず、後者にはarmor/Resistanceとの順序が記載されていない。
[公式の防具解説](https://www.minecraft.net/zh-hans/article/taking-inventory-leggings)は20防御で80%軽減と説明しているが、この説明だけでカスタム41の26.40実測結果を代用しない。
[Script API changelog](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/changelog?view=minecraft-bedrock-stable)と[26.40 changelog](https://feedback.minecraft.net/hc/en-us/articles/47787720931213-Minecraft-Bedrock-Edition-26-40)も参照した。

変更ファイルの完全な一覧は`combat_files.json`を参照。
