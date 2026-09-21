# NF共通基盤 v1 / 2026-09-21

ユーザー提供の `NF_COMMON_SPEC_V1.md` を実装契約とする。原本のID・名称・PNG・鑑定・図鑑を変更しない。

## 今回の実装範囲

- 食用の既存32種はアイテムのcooldownコンポーネントと摂食時のstartCooldown呼び出しを除去。食べる時間1.6秒、既存効果、遅延毒の期限は維持。ホコリタケは食事ではなく胞子放出なので4秒制限を維持。
- `nf_registry.js`: 正式100種を参照する性能登録口。個体別性能は未承認のまま。`registerPerformance()`は正式IDの存在・明示的な持続時間・牛乳解除・致死許可を検証。101以降も同じ方式で追加できる。
- `nf_state.js`: active状態だけを保持。Stack/Gauge/Phase、感染と症状の分離、オンライン秒、1感染1回の致死抽選、当落で共通の警告、牛乳・死亡・自然回復、保存復元。
- `nf_runtime.js`: 全NF共通の20tickタイマー1本。状態がないときは停止。被弾・使用・摂取・Effect追加・牛乳・死亡・接続をイベントへ接続。保存はactive NFごとに1Dynamic Propertyとし、100種全体を単一文字列に詰めない。
- `nf_interactions.js`: 巨大if文を避けた独立ルール。共存/免疫抑制などの文脈を提供し、細かな進行量・再活性化率は承認された定義のコールバックが決める。抗細菌ルールはbeneficialも除去対象。
- 通知は発症・Phase変化・重症警告・回復時のチャットのみ。ActionBarは占有しない。

## 個体性能は未実装

正式な個体別性能表がまだ揃っていないため、NF-021〜100を食料化していない。NF-001〜020も現在の実装状態を維持。全NFは従来どおり鑑定・収集・図鑑に対応する標本のままで、性能登録口を作ったことを「80種の効果実装完了」とは扱わない。

共通仕様には056の致死確率5/10/20%と30秒、069の15%と90秒、096の10%と90秒があるが、持続時間・重症条件・通常効果・ショック算出式などが未確定。これらを勝手に補完して有効化しない。75等の抑制量、81/85の減少量、96/98の再活性化条件も同様。

## 個体定義を追加する際の契約

1. 正式masterへIDを登録し、確定性能だけを `registerPerformance` へ渡す。durationのnullは明示的な無期限。
2. triggersは `damage`, `waterEnter`, `food`, `consumeItem`, `itemUse`, `positiveEffectsChanged`, `reconsume`。消費完了を伴う料理・ポーションは `consumeItem` で判別する。連続摂取で `infect()` を呼んでも感染時計・致死抽選を初期化しない。
3. baseEffects/phase.effectsは `{effect,level}`。現在のphaseに対応する症状を短時間更新する。症状抑制は `suppressEffects`。感染状態は残る。
4. `onInteraction` と `onImmuneContext` は文脈通知であり、時間進行ではない。イベント1回ごとに秒あたりの減少量を加算しない。フラグを更新し、時間に比例する計算は `onTick(state,seconds,manager)` へ置く。
5. 一時能力や後遺症を実装する個体は、復元に必要な情報をcustomDataへ保存し、`cleanup(player,state,reason)`で必ず戻す。牛乳/死亡/自然回復/他NFによる治癒に共通適用される。個体別の最大HP操作・聴覚障害そのものは未実装。
6. 登録した食用NFを実際に摂取できるようにするときは、その確定した食品定義と摂取コンポーネントを追加して `nfRuntime.activate(player,id)` へ接続する。現段階で標本へ未承認の栄養値や食事動作を足さない。

## API上の制約と検証

[公式WorldAfterEvents](https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/worldafterevents?view=minecraft-bedrock-stable)には水侵入イベントとEffect解除イベントがない。その2件は、関連triggerを持つactive状態のプレイヤーだけを共通20tick更新内で確認し、変化をイベントとして渡す。水侵入は最大約1秒の検出遅延がある。全プレイヤー・全100種の毎tick監視はしない。

保存は最後の1秒更新/イベント時点。オフライン中の実時間は加算しない。各感染の保存を検証してから復元し、不正データを黙って初期化しない。

テストで、致死10秒前の牛乳救済、抽選失敗後の再抽選禁止、再感染、警告の同一性、死亡解除、オンライン時間の保持、段階回復、症状抑制解除、スタック/ゲージ上限、101以降、105状態でもScheduler1本、連続摂食を検証する。模擬API試験であり、Bedrock上の実食・死亡・再接続の実機確認は別途必要。
