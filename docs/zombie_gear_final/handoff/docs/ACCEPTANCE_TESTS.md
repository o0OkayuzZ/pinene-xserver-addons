# ACCEPTANCE TESTS

Codexは最低限ここまで確認してから完了報告する。

## Assets
- [ ] 20 item IDs exist
- [ ] 20 item icons are exact 32×32 RGBA PNG
- [ ] all icons face front
- [ ] chestplate eye exists only on chestplate, all C0-C4
- [ ] eye is player-left / viewer-right in front view
- [ ] 20 worn stage variants correctly reference geometry+texture
- [ ] C0→C4 visual progression matches accepted reference
- [ ] first/third-person behavior has no major regression
- [ ] enchant glint works

## Base stats
- [ ] protections = helmet2/chest4/legs4/boots1
- [ ] full total = 11
- [ ] partial gear has no HP80/set abilities

## Effective C
- [ ] C4/C4/C4/C1 => effective C1, abilities remain enabled
- [ ] C2/C3/C4/C2 => effective C2
- [ ] mixed set is NOT treated as corruption=-1

## KB
- [ ] effective C0 => total 0.40
- [ ] C1 => 0.56
- [ ] C2 => 0.72
- [ ] C3 => 0.88
- [ ] C4 => 1.00
- [ ] C4/C4/C4/C1 behaves as C1 (0.56), not a per-piece additive exploit

## Stock/C transitions
- [ ] C0/stock4 lethal => C1/stock3 and all four pieces C1
- [ ] C1/3 => C2/2
- [ ] C2/2 => C3/1
- [ ] C3/1 => C4/0
- [ ] C4 cannot hold positive stock
- [ ] cell: C4/0 => C3/1
- [ ] cell: C3/1 => C2/2
- [ ] cell: C2/2 => C1/3
- [ ] cell: C1/3 => C0/4
- [ ] C0 stock0→1→2→3→4 by cells; stays C0
- [ ] on equip change, stock clamps to `4-effectiveC`
- [ ] state transition preserves durability/enchants/name/lore/etc.
- [ ] failed 4-piece swap rolls back and consumes nothing

## Charge
- [ ] requires full set, selected Zombie Stem Cell, sneak, out of actual combat
- [ ] exact ~8 sec
- [ ] release cancels
- [ ] held item change cancels
- [ ] actual combat cancels
- [ ] environmental damage alone does not incorrectly set long combat lock
- [ ] cell consumed only on successful completion

## Effects / damage
- [ ] HP80 on full set
- [ ] external Strength II + gear => Strength III
- [ ] remove gear restores external Strength
- [ ] Absorption still functions after revive
- [ ] native armor/enchantment damage handling is not bypassed during revive recovery
- [ ] addon lethal path never eats a revive unless recovery actually succeeds
- [ ] external Health Boost is restored

## Food
- [ ] normal food: buffs allowed, hunger/saturation unchanged
- [ ] Rotten Flesh: hunger/saturation normal + HP8 + 10% armor repair
- [ ] cake cannot bypass normal-food restriction
- [ ] Regeneration and Instant Health blocked
- [ ] Absorption allowed

## Localization
- [ ] all 20 variants show Japanese names, no raw identifier in UI

## Validation
- [ ] JSON parses
- [ ] Script type/syntax checks
- [ ] gameplay mock tests updated and pass
- [ ] in-game smoke test performed
- [ ] report changed files and remaining engine-specific risks
