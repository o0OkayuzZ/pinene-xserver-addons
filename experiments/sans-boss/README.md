# Sans boss — development v0.6.0

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

## Combat revision 0.3.0

Blasters draw a dense black ray for the 24-tick telegraph, then switch the same
one-cube ray to a thick emissive white/cyan beam for 16 ticks. Width pulses from
1.05 blocks to 0.9; terrain clips both the visible ray and damage at the same point.
The ray is independent of particle budgets. The head drifts around its spawn
anchor until the eight-tick aim lock, then retains a small cosmetic hover/roll.
Opening the jaw also applies a rapidly decaying recoil to the skull and jaw.

Beam contact still deals 0.75 HP each tick and adds 0.25 HP of KARMA debt, capped
at 6 HP and current health minus one. After 10 contact-free ticks, KARMA drains
0.25 HP every four ticks, including after leaving the beam/encounter radius.
It cannot kill by itself; direct hits can. Purple particles mark each pulse.
Death, logout, creative/spectator mode, dimension changes and boss defeat/unload
clear the debt. Reloading scripts also clears it. No shared HUD files are replaced;
the purple health bar in the offline preview is explanatory only.

Render the revised attack preview with:

```sh
node tools/build_attack_timeline.mjs
python tools/render_attack_preview.py
```

Its trajectory and health/debt snapshots use the real pure JavaScript combat
rules; the exported models and textures are rasterized offline. It is not an
engine capture. Native shader output, damage/totems and multiplayer remain
subject to in-game verification.

## Arrival and departure revision 0.4.0

The dark telegraph is 0.06 blocks wide (previously 0.10). Over its first ten
ticks, the skull grows from a tiny tilted silhouette, slides forward/up and
settles with a slight overshoot into its hover. After the sixteen-tick blast,
the ray disappears immediately. The jaw closes over the first part of a
fourteen-tick retreat; the skull tilts, rises and slides backwards while
shrinking to zero. The retreat is cosmetic; direct damage stops with the ray.
Charge duration, aim lock and KARMA rules are unchanged.

## Encirclement revision 0.5.0

The black telegraph is now 0.025 blocks wide. Four blasters (six in the later
combined pattern after 15 warps) appear one by one at four-tick intervals on
an eight-block ring. Opposite sides appear alternately, with alternating
heights. Each head gets its own full 24-tick warning, final eight-tick aim
lock and sixteen-tick firing window; firing follows the arrival rhythm.
Queued spawns are cancelled on boss defeat or when no eligible target remains.
The cap is six heads per boss including queued slots, and combined damage
remains capped at 1 HP per tick.

## Vertical exit flip 0.5.1

Retreat now lasts eighteen ticks (0.9 seconds). The entire skull pitches
through a full backwards vertical turn around its center, without an exit
roll. Its scale follows 1 - departure², keeping the first half of the turn
large and readable before it shrinks away. Backwards/upwards retreat, jaw
closure, beam cutoff, warning width and staggered encirclement are retained.

## Beam collapse 0.5.2

The last eight firing ticks narrow the beam to zero with a smoothstep
envelope. Collision radius follows half the current visible width, capped
at the original 0.45-block radius. The ray disappears at the same fire-end
tick as before, followed by the head's full vertical retreat flip. Contact
damage and KARMA amounts are unchanged.

## Popping backward exit 0.5.3

The exit turns nose-up into a full backwards vertical flip. A small vertical
hop follows 7*sin(pi*departure)+4*departure pixels, rather than rising in a
straight line. Backward travel is shortened to eighteen pixels at full exit.
The head shrinks continuously through the turn using the existing 1 -
departure² envelope. Beam collapse and all combat timings are unchanged.

## Reversed arrival exit 0.5.4

Exit now retraces the arrival transform with presence = arrival*(1-departure).
The same smoothstep drives tilt, twist, size and local translation in both
directions. Departure lasts ten ticks, matching arrival: the head settles
back into its tiny tilted silhouette behind/below the hover position and
disappears. The pop and full vertical flip are replaced by this reversed
arrival. Beam collapse, encirclement and damage rules are retained.

## Bone wall animation 0.6.0

Each bone receives a persistent thin black ground marker for the first twelve
warning ticks. It rises from below ground during the final six warning ticks
without dealing damage. The active wall advances with a small damped height
bounce; its visible height is shared with collision. After the original
65 active ticks, movement and damage stop and the bone sinks over eight
cosmetic ticks. Ground markers and bones are removed together on cleanup.
Low walls remain jumpable and tall walls retain the two-slot dodge gap.
