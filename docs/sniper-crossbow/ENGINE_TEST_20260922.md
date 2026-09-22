# Sniper Crossbow engine test — 2026-09-22

This test targets the stacked Sniper Crossbow branch after Bomb Crossbow v0.1.

## Test kit

Enable BP09, RP07 and BP15 in a Bedrock development world.

```mcfunction
/give @s minecraft:crossbow 1
/give @s minecraft:spyglass 8
/give @s minecraft:iron_ingot 64
/give @s minecraft:tnt 32
/give @s minecraft:string 32
/give @s minecraft:arrow 64
/give @s pinene:bomb_bolt 64
/give @s pinematerials:zyunzentarucrossbownotamashii 16
```

Place a smithing table and prepare:
- a nonflammable blast-test structure
- flammable blocks around (not directly required to be destroyed)
- a mob with enough HP or a target dummy for direct-hit tests
- a long straight shooting lane

## 1. Crossbow forge / order independence

Sneak while holding the source crossbow and interact with the smithing table.

Expected forge options depend on the current state.

### Route A

```text
minecraft:crossbow
 -> sniperize
 -> awaken I
 -> awaken II
 -> TNTize
```

Expected final ID:
`pinene:sniper_tnt_crossbow_awakened_2`

### Route B

```text
minecraft:crossbow
 -> TNTize
 -> awaken I
 -> awaken II
 -> sniperize
```

Expected final ID:
`pinene:sniper_tnt_crossbow_awakened_2`

Both routes must end in the same item type.

### Costs

Sniperization:
- spyglass x1
- iron ingot x1

TNTization:
- TNT x1
- iron ingot x3
- string x2

Awakening:
- Pure Crossbow Soul x1 per depth

Depth III must expose no further awakening action.

## 2. Metadata preservation

Before modifying a crossbow, give it:
- durability damage
- at least one valid crossbow enchantment
- a custom name
- lore if available

Transform it through multiple axes.

Expected:
- proportional durability wear preserved when max durability changes
- enchantments preserved
- custom name preserved
- lore preserved
- dynamic properties preserved
- keep-on-death / lock state preserved
- CanDestroy / CanPlaceOn preserved

A failed transform must not consume ingredients.

## 3. Scope mode

Hold any Sniper Crossbow and sneak.

Expected:
- FOV changes to 20
- vanilla crosshair is hidden
- a circular black spyglass-style mask appears
- custom central reticle appears
- scope remains while sneaking with the weapon held

Stop sneaking or switch away.

Expected:
- camera FOV resets
- scope HUD disappears
- vanilla crosshair returns only if this system hid it
- no stale action-bar marker remains visible

Repeat after death/respawn to ensure the camera is not left zoomed.

## 4. Precision flight

Fire a non-TNT Sniper Crossbow over a long distance.

Expected:
- projectile is visibly faster than a normal arrow
- much less drop
- no intentional spread
- projectile remains aligned with the original fired direction

Runtime contract:
- speed target: 8.0
- gravity: 0.012
- uncertainty: 0

## 5. Direct-hit progression

Measure direct hit damage with no TNT explosion:

| Depth | Sniper direct damage |
| --- | ---: |
| 0 | 14 |
| I | 18 |
| II | 22 |
| III | 26 |

Sniper TNT direct hit target:

| Depth | Sniper TNT direct damage |
| --- | ---: |
| 0 | 10 |
| I | 13 |
| II | 16 |
| III | 19 |

With PvP disabled, the scripted extra direct hit must not damage another player.

## 6. Sniper TNT explosion progression

Fire each Sniper TNT depth into comparable terrain.

| Depth | Native explosion radius |
| --- | ---: |
| 0 | 4 |
| I | 5 |
| II | 6 |
| III | 7 |

Every depth must:
- destroy terrain
- use `breaksBlocks: true`
- use `causesFire: false`
- create zero fire blocks

## 7. Launch-time snapshot

Fire a Sniper TNT projectile, then immediately switch to another depth before impact.

Expected:
- projectile retains the depth captured at launch
- explosion strength is not changed by post-shot weapon switching

## Pass criteria

PASS requires:
- all seven sections observed in-game
- no Script API errors
- no missing-content errors
- scope UI appears and exits cleanly
- both Route A and Route B converge to the same final item
- all agreed direct-hit and explosion progressions behave as specified

Server startup alone is not gameplay certification.
