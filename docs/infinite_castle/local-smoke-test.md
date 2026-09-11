# Phase 1 ローカル実機テスト — 2026-09-11

対象: `IC Phase 1 - FRESH TEST 20260911`、Minecraft Windows v26.45、`@minecraft/server 2.9.0`。

新規の空のBedrock LevelDBから作成。seed `2026091101`、フラット、初期Creative、Normal、チート・座標有効、ローカル専用。既存ワールドのチャンク・プレイヤー・動的プロパティを複製していない。リポジトリの16 BP + 19 RPをワールド内へコピーし、全ファイルをバイト照合。配置記録は [local-test-world.json](local-test-world.json)。keep inventoryは初期有効だったが、既存パックの死亡・墓処理が実機で動作したため所持品保持を保証しない。

## 実機で発見した不具合と修正

1. 初回の構造物配置で `ReferenceError: bounds is not defined`。`placePlan` が保護判定へ未定義変数を渡していた。配置範囲を計算してロード・保護判定へ共通で渡すよう修正。実機で34棟の配置、階段8棟、6382箇所の整合性確認、38接続の処理が完了。
2. 無人の城の建築完了後、`new source castle entrance target is unavailable`。一時ロードを解放した到着先でブロックを照会していた。到着部屋を読み込み、安全な着地点を確認し、入口演出の転送完了までロードを保持する処理を追加。転送準備の失敗だけで完成済みrunをBUILD_FAILEDにせず、再試行時の不要な全再建築を防ぐ。

3. 到着チャンクのロード後も着地候補なし。`Block.isSolid` はpreview専用で、安定版では床判定が常に失敗し、敵弾の空気判定も常に壁になっていた。実際の構造物6種を確認し、床は検証済みのfull-height素材、飛翔物は安定版の `isAir` / `isLiquid` とtypeIdで判定。モックからpreviewの `isSolid` を除去して回帰テストを追加。[MicrosoftのBlock定義](https://github.com/MicrosoftDocs/minecraft-creator/blob/main/creator/ScriptAPI/minecraft/server/Block.md) もpreview指定を確認した。

修正後のPhase 1テスト26件と既存Garden・Materials・Vaultの3件、計29件PASS。到着先の未ロード、障害物・例外時の解放、ロード期限・容量不足、preview API非依存の回帰テスト4件を含む。静的検証PASS。これらの自動テストはMinecraft APIの実装を再現するものではない。

4. 戦闘開始時に `InvalidEntityError: addTag` と無効なEntityのdimension参照。Dungeonsの通常スポーンはVanillaを含め確率で別Entityへ変身するため、返却ハンドルが登録前に失効していた。全管理Mobに専用 `spawnEvent` と `initialPersistence` を指定し、無効なentitySpawn通知を除外。Vanilla zombie/skeleton/witchにも無限城専用のhealth/attack groupを追加し、通常の変身イベントは管理tagのない個体だけで実行する。通常の定義は意味的比較で保持を確認。

5. Resistance VでもVanguardからダメージを受けた。before-hurtで攻撃値を固定すると、既に計算された防具・Resistanceの軽減を上書きしていた。通常攻撃は専用componentの基礎値を使い、被ダメージの上書きを撤去。管理Skeletonの矢は8、管理Necromancer/大呪術師の弾は4の専用projectile groupを所有者で限定適用する。その他の矢・弾の設定は保持。軽減後0/0.8/3.2の維持と所有者限定の弾設定を回帰テストで確認。

## 実機で確認した結果

- 35パックを読み込み、カスタムdimensionを生成。初回建築完了後、入口演出を経て安全な床へ到着。再入場で全建築を繰り返さない。
- 実際のSurvivalプレイヤーの部屋進入でguard戦闘開始。Vanguard・Royal Guard・Skeleton・Zombieの出現を視認。
- 修正後、Resistance Vを付けて近接攻撃・矢を受け続けてもHPは20を維持。これは無防具・Resistance Vの確認であり、防具別・耐性段階別のバランス測定は未実施。
- Wave 2への自動進行を確認。statusは `wave:2`, `state:Active`, `managed:7/45`, `error:""`。status取得時はCreativeへ戻していたため `players:0`。
- 入口へ戻って効果を解除し、戦闘部屋が無人になると管理Mobを掃除する状態へ戻した。runはACTIVEのまま保持。
- 引き渡し時は入口 `(1141.5,108,965.5)` でSurvival、一時停止。ネザライト防具一式・剣・ステーキ64個を用意。最初のguard部屋へ直接行く場合は `/tp 1223.5 108 976.5`。デバッグで強制開始していないため、その部屋の報酬はデバッグ無効化の対象ではない。
- 自動テスト29 PASS、最後の弾調整後のRuntime回帰テストもPASS。静的検証で管理Mob18設定、通常Mob12定義＋弾2定義の分離、基礎弾ダメージを確認。

## パック更新時の注意

実行中のMinecraftはパックのファイル一覧をキャッシュする。今回追加した `phase1Landing.js` はワールド再入場だけではimportできず、アプリを正常終了して再起動した。配布パック自体には新規ファイルが存在し、バイト照合済み。

## 残る確認

画面記録: [入城status](evidence/arrival-status.png)、[guard Wave 2](evidence/guard-wave2-status.png)、[入口で一時停止](evidence/ready-paused.png)。

報酬の一度きりの補充・鍵演出・出口帰還、全Encounter、1～4人のダメージ・45体負荷・再構成中の固定ブロック不変は実機で未確認。最後に調整したNecromancer弾の基礎値4は静的・回帰テストで確認し、実機での命中値測定は未実施。[実装報告](phase1-implementation.md) の受け入れ項目全体の合格を示すものではない。

既存のDungeonsクロスボウrender controller、音声アセット、lighting、blue diamond apple/onsoレシピにContent Logエラーあり。今回のPhase 1変更とは別に残っており、Content Log全体がエラーなしとはしていない。

Xserver本番・既存ワールド・元のdevelopment packsは更新していない。

2026-09-12のMob・鍵演出・空チェスト修正と実機確認: [3件の修正報告](three-fixes-20260912.md)。
