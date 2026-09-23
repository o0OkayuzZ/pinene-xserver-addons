# Bomb Crossbow engine test — 2026-09-22

## Test kit

Run in a Bedrock development world with BP09 / RP07 / BP15 enabled:

```mcfunction
/give @s pinene:bomb_crossbow 1
/give @s pinene:bomb_bolt 64
/give @s pinematerials:zyunzentarucrossbownotamashii 3
```

Have a smithing table, a flammable test block, stone/terrain targets, and a safe blast area.

## 1. Pure Crossbow Soul visual

Expected:

- inventory icon resolves (no missing-texture tile)
- texture is exactly 32×32 RGBA
- icon is the adopted blue/violet anima-orb crossbow soul
- transparent pixels render transparent in inventory/UI

## 2. Base Bomb Crossbow

Fire a bomb bolt into stone terrain.

Expected:

- projectile launches after 1.8 s charge
- direct impact damage remains 6 before native explosion effects
- native explosion radius profile = 4
- terrain is destroyed
- no fire blocks are created

## 3. Awakening flow

Hold the Bomb Crossbow, sneak, and interact with a smithing table.

Expected:

1. normal -> Depth I; consumes exactly 1 Pure Crossbow Soul
2. Depth I -> Depth II; consumes exactly 1 soul
3. Depth II -> Depth III; consumes exactly 1 soul
4. Depth III interaction consumes nothing and does not upgrade

Expected preserved state after each upgrade:

- durability damage
- enchantments
- custom name
- lore
- dynamic properties
- keep-on-death / lock state
- CanDestroy / CanPlaceOn

## 4. Explosion progression

Fire one shot from each depth into comparable terrain.

Expected native explosion radius profile:

| State | Radius |
| --- | ---: |
| Normal | 4 |
| Depth I | 5 |
| Depth II | 6 |
| Depth III | 7 |

Every depth must use:

- `breaksBlocks: true`
- `causesFire: false`

## 5. Launch-time depth snapshot

Fire a shot, then immediately switch to a different Bomb Crossbow depth before impact.

Expected:

- projectile keeps the depth captured when it spawned
- weapon switching after launch does not alter its explosion radius

## Pass criteria

All five sections pass with no Script API errors or missing-content entries in the Bedrock Content Log.

Server startup alone is not gameplay certification; the smithing interaction and four live explosions must be observed in-game.
