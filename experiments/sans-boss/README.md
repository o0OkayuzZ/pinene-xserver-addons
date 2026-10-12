# Sans boss — development v0.2.0

Independent Bedrock BP/RP under the authoritative `pinene-xserver-addons` repo.
No production world registration is changed. Stable `@minecraft/server` 2.7.0 is required;
the current development client is 1.26.52. Experimental APIs are not required.

## Play

For the established Windows development world, close Minecraft completely and run
`tools/install_dev.ps1`. It verifies the world name and pack UUIDs, backs up both world
pack-list files, adds only this pair of packs and preserves all existing registrations.
If Minecraft is open it stops without changing the world. The Desktop launcher
`Apply_Sans_To_Dev_World.cmd` invokes this installer.

Activate both Pinene Sans Boss packs. In a flat, open test area, run:

```mcfunction
/summon pinene_sans:sans ~ ~ ~
```

The spawn egg is also in Creative → Nature. Creative/spectator players are not targeted
or damaged. Switch to survival to test combat. Remove with:

```mcfunction
/kill @e[type=pinene_sans:sans]
```

## Rules

- Incoming attacks have exactly 0% hit chance at zero successful warps.
- Each successful warp adds 2 percentage points, capped at 100% after 50 warps.
- The attack rolls against the count *before* its dodge warp. Missed melee/projectiles
  are cancelled before damage is applied; no heal-after-death workaround.
- Failed teleports never add fatigue. Concurrent dodges queue at most one warp,
  and actual warp movement has a 6 tick cooldown.
- Sans also warps every 50 ticks while a survival/adventure player is within 32 blocks.
- Warp count persists through unload/save/rejoin and pauses when no target is nearby.
- Sans has 1 HP. One successful damaging hit normally wins the encounter.
- Environmental damage is ignored, except the void and administrative `/kill`.
- Bone walls have 18 ticks of warning, a two-block gap, and alternate jumpable and tall
  variants. Later patterns cross walls and combine them with beams.
- Blasters charge for 24 ticks, lock aim 8 ticks before firing, then fire for 16 ticks.
  Terrain stops beams; no block destruction. Blaster count rises to three after 15 warps.
- Bone contact drains 0.5 HP per tick; beams drain 0.75 HP per tick (20 ticks/second).
  Combined damage is capped at 1 HP per tick across all bosses and hazards.
- Nonlethal contact directly drains health to bypass vanilla hurt invulnerability.
  This intentionally bypasses armor/shields/resistance. The final hit uses native damage
  for death attribution and totem handling; its engine acceptance needs in-game testing.
- Maximum four active bosses, 24 bone hazards and three blasters per boss. No targets
  or boss death removes hazards immediately; native 8-second timers provide a safety expiry.
- Extra bosses above the limit are passive and invulnerable until a slot opens.

Tune `BP/scripts/combat.js` for percentages, damage and intervals. Set `minecraft:health`
in `BP/entities/sans.json` if a multi-hit version is desired.

## Build and verify

```sh
python tools/build_assets.py
node --experimental-vm-modules --test tests/*.test.mjs
python tools/validate_pack.py
```

Models/textures are original cube assets authored by `tools/visual_assets.py` and built by
`tools/build_assets.py`; only
vanilla sounds are used. The resource pack declares PBR and a matte texture set to
coexist with Vibrant Visuals. No music or external model assets are bundled.

## Validation boundary

Automated tests validate dodge ordering, failed/successful warps, persistent fatigue,
collision geometry, 20 Hz health drain, warning windows, cleanup and pack references.
Minecraft engine visuals, lethal damage/totems and combined mod compatibility still
require an actual in-game run. This is an initial playable development version.

API references:
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityhurtbeforeevent
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entityattributecomponent
- https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/entity

## Visual revision 0.2.0

Rounded skull and recessed sockets; individually placed teeth; padded collar, hood,
pocket pose, sleeve cuffs, shorts stripes and slippers. The left eye switches from a
white pupil to an emissive cyan eye while hazards are active. A tapered Gaster Blaster
has separate skull/jaw pivots, cheek ridges, rear horns, fangs and a firing core.
Fatigue also tips the torso forward. Seven cubes per attack bone keep wall hazards cheap.

`tools/render_preview.py` draws the exported geometry/UVs with a depth buffer and
same jaw pivots. Install NumPy and Pillow to render it. This offline preview uses
neutral studio lighting; Minecraft appearance still needs in-game verification.
