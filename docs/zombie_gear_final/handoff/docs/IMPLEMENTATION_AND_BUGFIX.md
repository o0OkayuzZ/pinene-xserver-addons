# IMPLEMENTATION + BUGFIX REQUIREMENTS

最終実装では、新仕様だけでなく既に洗い出したランタイム不具合も同時に解消する。

## 必須修正

### 1. Enchantable
20個すべてのZombie Gear itemに正しい `minecraft:enchantable` を持たせる。
部位ごとのarmor slotを正しく設定し、C変換後もenchantを保持。

### 2. Strength +1
外部Strengthを正しく読み、
- no potion → Strength I
- Strength I → Strength II
- Strength II → Strength III
となるようにする。

before effect eventで取得できないamplifierを推測しない。
使用中に追加された外部Strengthも正しく保存/復元する。

### 3. Post-revive damage / Absorption
蘇生直後のノックバック制御のために、native damageをcancelして本体HPを直接減らす実装は避ける。
Absorption、防具、エンチャ、他addonイベントを壊さない。

「ノックバックを抑える」と「Minecraft標準ダメージ処理を飛ばす」を分離する。

### 4. Combat lock
環境ダメージを無条件にcombat扱いしない。
少なくとも:
- 落下
- 溺れ
- 自身の日光炎上/通常炎上
などだけで20秒の幹細胞チャージ禁止を更新しない。

実際の攻撃者を伴う戦闘を主対象にする。

### 5. Death fallback
`afterEvents.entityDie` で死亡済みEntityにHPを戻してstockだけ消費する危険なfallbackを信用しない。
死亡後イベント経路で蘇生保証できない場合はstock/Cを消費しない。
致死判定を可能な限り死亡成立前に処理する。

### 6. Health Boost coexistence
他addon由来Health Boostを保存/復元。
特に amplifier 14 が偶然同じ場合でもownershipを値だけで判定しない。
装備中に新しい外部Health Boostが来るケースも壊さない。

### 7. Food restriction
通常食の満腹度/Saturation無効化に抜け道を残さない。
cake等の通常itemCompleteUseを通らない食事も実機確認。
Rotten Fleshだけは現行例外。

### 8. 8-second charge accuracy
HUDが0.0秒になってから最大約0.75秒待たされる状態を解消。
charge completion判定を十分細かいtick間隔で行う。

### 9. old naming cleanup
`holdingTotem` 等、現在Zombie Stem Cellを指している旧命名は `holdingStemCell` 等へ整理。
挙動を変えず可読性を上げる。

## Refactor（安全なら実施）
巨大なmain.jsを無理なく責務分割:
- config/rules
- gear/corruption
- revive
- effects
- diet
- sunlight
- UI/controls
- combat/infection

ただし大規模リファクタで挙動を壊すくらいなら、まず仕様実装とテストを優先。
