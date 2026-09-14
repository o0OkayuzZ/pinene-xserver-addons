# FINAL acceptance results — 2026-09-13

各項目は静的検証・API mock・実機を組み合わせて確認。チェックは全項目を実機で個別測定した意味ではありません。具体的な手段、実機44項目のログ、特殊Persona体型などの制約は IMPLEMENTATION_REPORT.md を参照してください。

## Assets
- [x] 20 item IDs exist
- [x] 20 item icons are exact 32×32 RGBA PNG
- [x] all icons face front
- [x] chestplate eye exists only on chestplate, all C0-C4
- [x] eye is player-left / viewer-right in front view
- [x] 20 worn stage variants correctly reference geometry+texture
- [x] C0→C4 visual progression matches accepted reference
- [x] first/third-person behavior has no major regression
- [x] enchant glint works

## Base stats
- [x] protections = helmet2/chest4/legs4/boots1
- [x] full total = 11
- [x] partial gear has no HP80/set abilities

## Effective C
- [x] C4/C4/C4/C1 => effective C1, abilities remain enabled
- [x] C2/C3/C4/C2 => effective C2
- [x] mixed set is NOT treated as corruption=-1

## KB
- [x] effective C0 => total 0.40
- [x] C1 => 0.56
- [x] C2 => 0.72
- [x] C3 => 0.88
- [x] C4 => 1.00
- [x] C4/C4/C4/C1 behaves as C1 (0.56), not a per-piece additive exploit

## Stock/C transitions
- [x] C0/stock4 lethal => C1/stock3 and all four pieces C1
- [x] C1/3 => C2/2
- [x] C2/2 => C3/1
- [x] C3/1 => C4/0
- [x] C4 cannot hold positive stock
- [x] cell: C4/0 => C3/1
- [x] cell: C3/1 => C2/2
- [x] cell: C2/2 => C1/3
- [x] cell: C1/3 => C0/4
- [x] C0 stock0→1→2→3→4 by cells; stays C0
- [x] on equip change, stock clamps to `4-effectiveC`
- [x] state transition preserves durability/enchants/name/lore/etc.
- [x] failed 4-piece swap rolls back and consumes nothing

## Charge
- [x] requires full set, selected Zombie Stem Cell, sneak, out of actual combat
- [x] exact ~8 sec
- [x] release cancels
- [x] held item change cancels
- [x] actual combat cancels
- [x] environmental damage alone does not incorrectly set long combat lock
- [x] cell consumed only on successful completion

## Effects / damage
- [x] HP80 on full set
- [x] external Strength II + gear => Strength III
- [x] remove gear restores external Strength
- [x] Absorption still functions after revive
- [x] native armor/enchantment damage handling is not bypassed during revive recovery
- [x] addon lethal path never eats a revive unless recovery actually succeeds
- [x] external Health Boost is restored

## Food
- [x] normal food: buffs allowed, hunger/saturation unchanged
- [x] Rotten Flesh: hunger/saturation normal + HP8 + 10% armor repair
- [x] cake cannot bypass normal-food restriction
- [x] Regeneration and Instant Health blocked
- [x] Absorption allowed

## Localization
- [x] all 20 variants show Japanese names, no raw identifier in UI

## Validation
- [x] JSON parses
- [x] Script type/syntax checks
- [x] gameplay mock tests updated and pass
- [x] in-game smoke test performed
- [x] report changed files and remaining engine-specific risks
