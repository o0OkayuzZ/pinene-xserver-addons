# 2026-09-12 実機不具合3件の修正

対象: `IC Phase 1 - FRESH TEST 20260911`、Bedrock 26.45、`@minecraft/server 2.9.0`。
Infinite Castle BP 0.2.1、Dungeons BP/RP 2.0.6。

## 修正

- Mob: 管理用イベントを「旧グループ除去→管理グループ追加」の順にし、対象探索とネイティブの経路探索・移動方式を明示的に保持。Royal Guard系は旧raidグループの除去でnavigationも失っていた。Endersentの速度・familyを保持し、スクリプト術者に接近・近距離回避を追加。通常の城外個体は変更しない。
- 鍵: 回転する光の鍵、上昇、弧を描く飛行、飛跡、宝箱の光輪、到着音と「封印解除」表示を追加。60tickの到着時に一度だけ解錠し、90tickまで余韻を表示。赤い鍵は途中で金色へ変化。
- 宝箱: `/loot` に渡す識別子を `chests/infinite_castle/guard` 等に修正。旧形式は実機で `loot_tables/loot_tables/chests/infinite_castle/guard.json.json` と解釈され失敗していた。コマンド後に実在アイテムを確認して報酬を確定し、失敗時は再試行。旧バージョンの空の「配布済み」宝箱は一度だけ復旧し、取得済み報酬の再補充を防ぐ。

## 検証

- 自動テスト36件成功。JSON35件、JavaScript構文32件、管理Mob18種、城外隔離14定義、debug関数17件の検証成功。
- 最終AIの実機100tick間隔測定: Royal Guard 5.467 blocks、隊長12.861、Endersent 8.354、Wraith 9.318、Nightmare 8.995、Plague 8.241、Rot 9.481。近距離で射撃中の個体が停止することはある。全18種・全状況の挙動や耐性バランスの網羅試験ではない。
- 通常guard部屋で鍵到着後の報酬投入を2回確認。最終確認では矢81本とパンケーキ1個。光の鍵・飛行・封印解除表示を画面で確認。専用particle IDに関するContent Logエラーなし。
- 既存の攻略済みelite / curse / guardの空チェスト3個について、中身の復旧を実際のチェスト画面で確認。
- テスト専用の自動操作コードはワールド内だけに一時追加し、終了後に除去。テスト中の死亡・消耗・追加攻略を引き継がないよう、保存済みのテスト開始前DBとlevel.datへ復元した。
- 変更した3パック計7,947ファイルが作業ツリーと一致。35パック全登録のバージョン整合性確認。ワールド側に入っていた新しいZombieGearの44ファイルは保持。

実機には既存の統合パックの `safeHasTag` 未定義やDungeonsのクロスボウ描画等の別件ログがあるため、Content Log全体がエラーなしとはしていない。

[測定記録](three-fixes-evidence/engine-samples.json) · [配置検証](three-fixes-evidence/deployment.json) · [鍵の飛行](three-fixes-evidence/key-flight.png) · [封印解除](three-fixes-evidence/key-unlock.png) · [復旧した宝箱](three-fixes-evidence/repaired-elite-chest.png)

接近AIパラメータは[Microsoftのmove_towards_target仕様](https://learn.microsoft.com/en-us/minecraft/creator/reference/content/entityreference/examples/entitygoals/minecraftbehavior_move_towards_target)を参照し、最終的に実機の座標変化で確認した。

復元後の最終セーブも[検査済み](three-fixes-evidence/restored-save.json)。3個のチェストのNBTに報酬が存在し、Inventory・Armor・Offhandと15部屋の攻略状態がテスト開始前と一致。元の上層橋の位置で保存し、ワールド一覧へ戻している。
