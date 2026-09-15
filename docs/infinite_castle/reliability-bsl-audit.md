# Infinite Castle Reliability v1.0 - BSL audit

Base: `d033ab99695c30c71fbcdbe4cdf0370923ad31b6`. Scanned all **94** BSL JSON loot tables.

Only `minecraft:heavy_core` was removed from `pots/trial_chambers/corridor.json`. All other entries in that table are unchanged. Castle V4 and all Special reward tables are unchanged from the base (checkout line endings ignored).

| Preserved item / enchantment | Direct source table | JSON pointer |
| --- | --- | --- |
| `minecraft:trial_key` | `chests/trial_chambers/corridor.json` | `/pools/0/entries/5/name` |
| `minecraft:trial_key` | `chests/trial_chambers/entrance.json` | `/pools/0/entries/5/name` |
| `minecraft:trial_key` | `chests/trial_chambers/intersection.json` | `/pools/0/entries/0/name` |
| `minecraft:trial_key` | `chests/trial_chambers/intersection_barrel.json` | `/pools/0/entries/0/name` |
| `minecraft:trial_key` | `chests/trial_chambers/supply.json` | `/pools/0/entries/5/name` |
| `minecraft:trial_key` | `pots/trial_chambers/corridor.json` | `/pools/0/entries/3/name` |
| `minecraft:ominous_trial_key` | `pots/trial_chambers/corridor.json` | `/pools/0/entries/11/name` |
| `wind_burst` | `pots/trial_chambers/corridor.json` | `/pools/0/entries/12/functions/0/enchants/0/id` |
| `minecraft:ominous_bottle` | `pots/trial_chambers/corridor.json` | `/pools/0/entries/6/name` |

The remaining keys, Wind Burst books and ominous bottles are intentional audit findings; this change does not remove them. JSON details: [reliability-bsl-audit.json](reliability-bsl-audit.json).
