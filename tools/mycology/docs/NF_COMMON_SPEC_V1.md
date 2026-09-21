# NF-021〜100 共通実装仕様 v1

## 1. 基本方針

NF-021〜100は、各キノコごとに独立した常時tick処理を作らない。

中央の `NF Registry` に個体ごとの性能を定義し、共通の `NF State Manager` がプレイヤーごとの状態を処理する。

更新対象は「現在NF状態を持っているプレイヤー・NFのみ」とする。

基本更新周期：

* 通常状態更新：20tickごと（約1秒）
* 被弾、水没、食事、アイテム使用など：イベント駆動
* 100種類全件を毎tick走査しない
* 101以降も同じRegistryへ追加可能

---

## 2. プレイヤーが保持するNF状態

各感染・特殊状態は概ね以下を持つ。

```text
nfId
startTime
remainingTime
phase
stacks
severity
flags
customData
fatalState
```

`customData` はNF固有情報用。

例：

* 033：dehydration
* 040：growthLevel
* 051：paralysisLevel
* 056：shockLevel
* 071：insertionCount
* 080：proliferationLevel
* 092：bleedingLevel
* 094：respiratoryLoad
* 095：hepaticLoad
* 100：airwayObstruction

状態が存在しないNFのデータは保持しない。

---

## 3. 共通タグ

相互作用判定用にNFへ内部タグを付与する。

主要タグ：

```text
bacterial
viral
fungal
parasite
toxin
prion
beneficial
archaea

neural
gastrointestinal
respiratory
hemorrhagic
hepatic

proliferation
immune_reaction
immunosuppression
latent
giant_virus
```

必要なら後から追加可能。

タグはプレイヤーへ直接表示しない。

### 使用例

075
→ `fungal` を標的

078
→ `bacterial` を標的
→ 有害菌・有益菌を区別せず作用

081
→ `proliferation` を抑制

083
→ `immune_reaction` を抑制
→ 自身には `immunosuppression`

068
→ `giant_virus` を抑制

090 / 094 / 096
→ `immunosuppression` 存在時に挙動変化

---

# 4. 状態進行システム

NFは必要に応じて、

```text
Phase 0
↓
Phase 1
↓
Phase 2
↓
Phase 3
```

という段階式にする。

ただし全NFにPhaseを強制しない。

例：

### NF-031 バラムチア

```text
潜伏
↓
初期神経症状
↓
重症神経症状
↓
最終段階
↓
致死判定
```

### NF-093 ハンターン

```text
発熱期
↓
低血圧期
↓
腎障害期
↓
回復期
```

こちらは時間経過しても永久に悪化せず、最後は自然回復する。

---

# 5. Script致死システム

NF-021〜100でScript致死を持つのは確定した21種類のみ。

致死抽選は、

**重症条件を満たした瞬間に1回だけ実行する。**

内部状態：

```text
fatalChecked
fatalScheduled
fatalExecuteAt
```

## 抽選成功

```text
fatalChecked = true
fatalScheduled = true
fatalExecuteAt = 現在時刻 + 猶予時間
```

## 抽選失敗

```text
fatalChecked = true
fatalScheduled = false
```

同じ感染中には再抽選しない。

再感染した場合は新しい感染として再抽選可能。

---

# 6. 致死対象21種

```text
021 フォーラーネグレリア
031 バラムチア
033 コレラ
036 HBV
041 O157
051 アレキサンドリウム
055 A群溶連菌
056 TSST-1
058 V. vulnificus
059 髄膜炎菌
066 リゾプス
069 HDV
086 熱帯熱マラリア
088 内臓リーシュマニア
090 クリプトスポリジウム
091 ラッサ
092 CCHF
093 ハンターン
094 MERS
096 CMV
100 ジフテリア
```

それ以外のNF-021〜100にはScript致死判定を追加しない。

ただしPoison、Witherなど通常ダメージによる死亡は可能。

---

# 7. 致死警告

プレイヤーには抽選結果を表示しない。

重症化時：

```text
⚠ 症状が危険域に達しています
```

致死タイマー終了15秒前付近：

```text
⚠ 症状が急速に悪化しています
```

`fatalScheduled == false` のプレイヤーにも同等の警告を表示できる。

そのためプレイヤーは「自分が致死抽選に当選したか」を判別できない。

---

# 8. 牛乳の共通仕様

牛乳はNFシステムにおける万能な緊急解除手段とする。

牛乳使用時：

```text
すべてのactive NF state
phase
stacks
severity
customData
latent state
fatalChecked
fatalScheduled
fatalExecuteAt
NF由来の一時的能力変更
NF由来の後遺症
```

を完全削除。

つまり致死抽選済みでも、

```text
重症化
↓
致死抽選成功
↓
残り10秒
↓
牛乳
↓
生存
```

が成立する。

091の一時的聴覚障害などもNF由来なので牛乳で解除する。

---

# 9. 死亡時

プレイヤー死亡時には全NF状態を削除する。

目的：

* リスポーン直後の再死亡防止
* Script死亡予約の残留防止
* 最大HP変更等の残留バグ防止

死亡後に感染状態を持ち越さない。

---

# 10. ログアウト・再接続

ログアウトでは状態を削除しない。

残り時間・phase・fatal timer等を保存し、再接続時に復元する。

ただしオフライン中に時間を進行させる必要はない。

**オンラインプレイ時間のみ進行**で統一する。

---

# 11. イベント駆動条件

以下は1秒周期監視だけに頼らずイベントで処理する。

### 被弾

対象：

055
056
092
097
など

### 水への侵入

対象：

021
058
など

### 食料摂取

対象：

032
040
057
071
など

### ポーション・NF料理使用

対象：

095など

### 正のEffect数変化

対象：

056

### 特定NF状態との共存

対象：

069 + 036

### 免疫抑制状態

対象：

090
094
096

---

# 12. NF同士の相互作用

相互作用を個別の巨大if文にまとめない。

Interaction Registryを用意する。

例：

```text
036 HBV + 069 HDV
→ delta_severe

054 giant_virus + 068 Sputnik
→ giant_virus抑制

fungal + 075
→ fungal状態弱体化

bacterial + 078
→ bacterial状態解除

proliferation + 081
→ 増殖度低下

080 HeLa + 085
→ proliferation大幅低下

056 + 083
→ immune_reaction停止

096 latent + immunosuppression
→ CMV再活性化

098 immune_amnesia + 096 latent
→ CMV再活性化率上昇
```

---

# 13. 症状と感染本体を分離する

重要。

```text
NF本体状態
```

と

```text
Minecraft Potion Effect
```

を同一扱いにしない。

例：

084 シクロスポリン系では、

感染本体：

```text
進行中
```

症状：

```text
Weakness
Nausea
Slowness
```

のみ一時的に抑制。

084終了後、

感染の現在phaseに対応した症状が再表示される。

これにより、

「症状を消した＝治療した」

にならない。

---

# 14. スタック型

以下のような個体は共通Stack APIを利用する。

```text
addStack()
removeStack()
setStack()
getStack()
```

例：

040 Candida → proliferation stack
046 Microcystis → toxin accumulation
071 LINE-1 → insertion count
080 HeLa → proliferation
092 CCHF → bleeding
097 → ulcer stack

最大値はNFごとに指定。

---

# 15. 条件ゲージ型

連続値を持つNFには共通Gauge APIを利用。

```text
0〜100
```

例：

033 dehydration
094 respiratoryLoad
095 hepaticLoad
100 airwayObstruction

共通処理：

```text
addGauge()
reduceGauge()
setGauge()
getGauge()
```

閾値は各NF定義側で設定する。

---

# 16. NF定義形式

各NFは概ね次の形式でRegistryへ登録する。

```text
NF {
    id
    displayName

    tags[]

    baseEffects[]

    duration

    phases[]

    stacks
    gauges[]

    triggers[]

    interactions[]

    fatal {
        enabled
        condition
        probability
        graceSeconds
    }

    milkClear: true
}
```

---

# 17. NF-056 定義例

```text
NF-056 TSST-1

tags:
bacterial
toxin
immune_reaction

shockLevel:
0〜5

shockLevel算出:
正のEffect数などから決定

Fatal:
Lv0〜2 → なし
Lv3 → 5%
Lv4 → 10%
Lv5 → 20%

猶予:
30秒

083 immunosuppression状態:
immune_reactionを抑制
→ Shock進行停止
```

---

# 18. NF-069 定義例

```text
NF-069 HDV

単独:
ほぼ無作用

036 HBVなし:
重症化不可
致死判定なし

036 HBVあり:
delta状態へ移行

delta重症化:
致死15%

猶予:
90秒
```

---

# 19. NF-096 定義例

```text
NF-096 CMV

初回:
latent状態を付与

通常:
無症状

immunosuppression検出:
reactivation

重症化:
致死10%

猶予:
90秒

098 immune_amnesia:
再活性化条件を緩和
```

---

# 20. 表示系

常時ActionBarを占有しない。

基本：

* 発症
* Phase変化
* 重症化
* 特殊能力発動
* 致死危険域
* 治癒

のタイミングのみ表示。

ゲージ表示がゲーム性に必要なNFだけActionBarを使用する。

例：

```text
麻痺 ███████░░░
出血 █████░░░░░
気道閉塞 ████████░░
```

すべての感染を常時表示する必要はない。

---

# 21. 軽量化

禁止：

```text
100種類 × 全プレイヤー × 毎tick
```

推奨：

```text
Active NF Stateのみ
×
20tick周期
```

加えて、

```text
被弾
食事
水没
アイテム使用
```

などはイベントベース。

時間判定もNFごとに大量の `runInterval()` を作らず、

**中央Scheduler 1本**

で管理する。

---

# 22. 将来拡張

NF-101以降も、

```text
Registryへ定義追加
↓
必要ならTrigger追加
↓
既存State Managerを利用
```

で実装可能にする。

NF番号100を上限として扱う処理は作らない。

---

# 実装優先順位

1. NF Registry
2. Player NF State Manager
3. 1秒周期Scheduler
4. 牛乳完全解除
5. Stack / Gauge / Phase共通API
6. Script致死Scheduler
7. Event Trigger
8. Interaction Registry
9. NF-021〜030
10. 031〜100を10種類単位で追加
11. 料理・ポーション・効果付き矢へ拡張
