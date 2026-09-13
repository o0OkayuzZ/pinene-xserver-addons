# Zombie Gear — FINAL SPEC

## 1. Runtime IDs

既存IDを維持する。1ID化しない。

各部位:
- `zombiegear:zombie_helmet`, `_c1`, `_c2`, `_c3`, `_c4`
- `zombiegear:zombie_chestplate`, `_c1`, `_c2`, `_c3`, `_c4`
- `zombiegear:zombie_leggings`, `_c1`, `_c2`, `_c3`, `_c4`
- `zombiegear:zombie_boots`, `_c1`, `_c2`, `_c3`, `_c4`

`base = C0`。

## 2. フルセット判定

頭・胴・脚・足すべてがZombie GearのいずれかのCバリアントならフルセット。
C段階が混在していてもフルセット能力は無効化しない。

部分装備は各アイテム固有の防御等だけで、フルセット能力なし。

## 3. 実効腐敗度

フルセット時:

`effectiveC = min(helmetC, chestplateC, leggingsC, bootsC)`

例:
- C4 / C4 / C4 / C1 → effective C1
- C2 / C3 / C4 / C2 → effective C2

旧仕様の「段階不一致なら腐敗倍率・蘇生を無効化」は廃止。

腐敗依存能力はすべて effectiveC を参照する。

## 4. 防御力

全C段階で固定。

| 部位 | protection |
|---|---:|
| Helmet | 2 |
| Chestplate | 4 |
| Leggings | 4 |
| Boots | 1 |
| 合計 | 11 |

革と鉄の中間程度を狙う。
Cが上がっても通常防御値は上げない。

## 5. Knockback Resistance

C0は「各部位0.10相当」＝フルセット合計0.40を基準とする。

**重要: 混在セットで各アイテムのCごとの値を単純加算してはいけない。**
KB耐性も effectiveC（最低C）だけで決める。

| effectiveC | フルセット最終KB耐性 |
|---|---:|
| C0 | 0.40 |
| C1 | 0.56 |
| C2 | 0.72 |
| C3 | 0.88 |
| C4 | 1.00 |

例: C4/C4/C4/C1 は **0.56**。C4側3部位の高い値を先取りできないこと。

Bedrock上で直接set全体のKB attribute制御が難しい場合も、混在加算バグを許容しないこと。
安全な実装手段を選び、実機テストで上表の挙動を確認する。

## 6. 腐敗攻撃倍率

既存仕様を維持し、effectiveCを参照。

| C | Scripted physical attack scaling |
|---|---:|
| C0 | +0% (×1.0) |
| C1 | +10% (×1.1) |
| C2 | +30% (×1.3) |
| C3 | +70% (×1.7) |
| C4 | +150% (×2.5) |

フルセットのStrength +1段階は別枠で維持。

## 7. 蘇生ストックと腐敗 — 可逆システム

### 基本
- revive stock: 0〜4
- 腐敗度 C0〜C4
- 腐敗は可逆。
- Zombie Stem Cellは「残機補充 + 腐敗浄化」に使える。

### 常時上限
`maxRevives = 4 - effectiveC`

装備変更等で effectiveC が上がり、現在stockが上限超過したら即座に上限へclampする。

例:
- effective C0 → stock max 4
- C1 → max 3
- C2 → max 2
- C3 → max 1
- C4 → max 0

これにより C4 + revive4 は絶対に成立させない。

### 蘇生
致死ダメージで蘇生可能な場合:
1. stock -1
2. `targetC = min(4, effectiveC + 1)`
3. 装備中4部位を **すべてtargetCへ揃える**
4. 装備変換時は metadata を保持
5. HP40（20ハート）で復帰
6. 既存の蘇生演出（音、赤フェード、Speed II 約3秒）を維持

代表遷移:
`C0 / stock4 → C1 / stock3 → C2 / stock2 → C3 / stock1 → C4 / stock0`

### Zombie Stem Cell 8秒チャージ
フルセット、非戦闘中、幹細胞を選択、しゃがみ継続で8秒。

完了時:
- effectiveC > 0:
  1. `targetC = effectiveC - 1`
  2. 4部位をtargetCへ揃える
  3. stock +1
  4. 幹細胞1個消費
- effectiveC == 0:
  - C0のままstock +1
  - stock 4で満タン
  - 完了時のみ幹細胞1個消費

代表逆遷移:
`C4/0 → C3/1 → C2/2 → C1/3 → C0/4`

C3/1のように現在の上限までstockを持っていても、幹細胞はCを1段浄化するため使用可能。
結果が C2/2 になる。

### キャンセル
8秒チャージ途中に:
- しゃがみ解除
- 幹細胞を手放す/持ち替える
- フルセットでなくなる
- 本当の戦闘状態になる
- 必要な装備条件が変わる

→ チャージ中断、幹細胞未消費。

## 8. 装備段階の混在

混在そのものは許可。
能力計算は最低C。

ただし「蘇生」「幹細胞チャージ」という状態遷移が成功した瞬間だけ、4部位をtargetCへ統一する。

装備を付け替えただけで高Cアイテムを勝手に低Cへ永久変換しないこと。

## 9. その他の既存フルセット能力

基本的に現行v4の意図を維持:
- 最大HP 80
- Strengthを現在の外部Strengthより+1レベル
- 近接感染
- 感染による攻撃低下/被ダメ増加
- 牛乳で感染解除
- Rotten Flesh: HP +8、通常の満腹度回復、Zombie Gear 10%修理
- 通常食: 食べられるが満腹度/Saturationは増やさない（アイテム固有效果は許可）
- Regeneration / Instant Health をフルセット中禁止
- Absorptionは許可
- 夜間の固有自然回復
- 昼の直射日光ペナルティ
- Hunger効果（現行仕様）
- C4でも上記セット能力は維持。ただしrevive capは0。

## 10. Metadata保持

C変換時、可能な限り以下を保持:
- durability damage
- enchantments
- nameTag
- lore
- keepOnDeath
- lockMode
- canDestroy
- canPlaceOn
- dynamic properties

失敗時は4部位をrollbackし、幹細胞/蘇生stockを消費しない。
