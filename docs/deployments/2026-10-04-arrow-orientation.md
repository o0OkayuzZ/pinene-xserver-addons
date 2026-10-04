# Arrow orientation repair

Arrows could appear to fly sideways or face away from the surface after impact. The PvP resource pack defined the vanilla identifier `animation.arrow.move` using only a Z-axis `query.body_x_rotation`. That replaced the shared yaw/pitch animation for ordinary arrows and six Dungeons projectile types. The legacy crossbow animation separately used body yaw rather than projectile target yaw.

The PvP animation and render controller now have private names, referenced by both current and legacy Shingan entities. Shingan's arrow body follows negative target pitch/yaw on the X/Y axes. Standard arrows and Dungeons arrows inherit the original vanilla animation again. All three legacy crossbow arrow bones use target yaw alongside target pitch.

Reference: [Mojang's vanilla arrow animation](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/animations/arrow.animation.json) and [arrow client definition](https://github.com/Mojang/bedrock-samples/blob/main/resource_pack/entity/arrow.entity.json). The vanilla animation retains impact shake and scale; the custom animations do not require an uninitialized shake variable.

| Projectile family | Coverage |
| --- | --- |
| `minecraft:arrow` | Ordinary bow/crossbow shots and addon weapons firing the vanilla entity |
| Dungeons | Burning, firework, harpoon, thundering, torment and void arrows |
| Legacy crossbows | 16 `sysc:arrow_*` entities, Bomb Bolt and Sniper Bolt |
| Shingan | `pinene_pvp:shingan_arrow` and legacy `pinen:shingan_arrow` |

This is a rendering correction. Projectile spawn code, velocity, gravity, spread, damage and homing behavior are unchanged. A ballistic arc or weapon-specific spread is not treated as an orientation error. Source inspection found the sniper replacement preserves the incoming velocity direction while normalizing its speed.

RP07 is 1.2.20 and PvP RP20 is 0.2.26. Dependent manifests, world registrations, README and website metadata match. Three orientation regression tests and five metadata tests pass. The orientation tests scan the resource packs for accidental vanilla-animation overrides and check the custom arrow consumers and rotation axes.

Local installation backs up every changed file and refuses content that differs from baseline `adb815fd`. The development and disposable validation worlds each received nine verified changed files. The old PvP resource cache was preserved separately before reloading Minecraft.

The user performed in-game acceptance testing and reported that the issue was fixed. Agent GUI testing stopped at their request. The ownership audit and diff whitespace check pass.

After the user's explicit publication/deployment request, production was updated with zero players online. Ten changed files were backed up, installed and verified, then the service restarted. The installer preserved unrelated pack metadata and refuses a modified content baseline. Backup: `/opt/minecraft/server/_pinene_deploy_backups/dungeons-213-20261004-validated/arrow-orientation-20261004/before`.

Production reported `Server started.` at **2026-10-04 13:06:06 JST**. The service is active, all ten deployed file hashes match, and the new startup/content logs contain no errors, exceptions or failures.
