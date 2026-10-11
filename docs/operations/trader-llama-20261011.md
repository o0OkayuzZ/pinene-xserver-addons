# Wandering trader density and trader llama compatibility

Server observed: Bedrock 1.26.52.3, 12 loaded vanilla wandering traders near the player; no rare material traders. No addon definition or script was found spawning minecraft:wandering_trader. The reported village correlation is not yet a proven engine root cause.

The trader llama override used geometry.llama plus controller.render.llama but declared only Texture.default, while that controller expects variant and decor texture aliases. Its custom skin is a 64x64 color-band placeholder. Restore the official complete adult/baby definition, textures, walking/head animation and trader decor in RP02 and the higher-priority Pinenite compatibility RP. Keep the unused skin file on disk.

Density mitigation: only a newly spawned, unnamed, scheduled natural trader is considered. A marker added solely to the native minecraft:scheduled event identifies it; the baseline vanilla behavior, timer, trades and two-companion spawn are otherwise identical to the server's highest available vanilla trader definition (vanilla_1.21.0). A loaded unnamed trader within 96 blocks suppresses the new duplicate. Existing, named and manually summoned traders are retained. Remove only untouched llamas whose exact leash-holder ID is the rejected new trader; preserve named, tamed and player-leashed llamas. No recurring global entity scan or bulk cleanup.

The marker defaults false on older saved entities. The override is pinned to the current server vanilla definition; review the fixture against vanilla when upgrading the server. It does not claim to fix the unproven village spawning cause itself.

Validation: density and rendering regression tests, original native behavior preservation, Pinenite reference/schema tests, isolated local Bedrock world. The existing broad outline test has a stale Zombie Gear ownership baseline that rejects an already-committed bomb_bolt change; this task does not alter that entity. Other old tests reference removed blue-diamond recipes. These unrelated failures are not modified here.

Versions: integrated BP 1.0.82, integrated RP 1.0.70, Pinenite outline RP 1.0.7. Food RP remains 0.2.4, including all 35 alpha-edge fixes.

Final real-client result: 12 newly scheduled natural traders -> 1 natural trader; 1 named manual trader retained; 4 linked companion llamas total. Adult and baby llama renders use normal vanilla colors and trader decor. The event check runs after 5 ticks so the scheduled event property is applied. On this client, leashHolderEntityId returned the holder type identifier; use leashHolder.id for exact individual matching. The regression test deliberately models that mismatch.

Targeted validation: 8 trader/llama tests and 5 Pinenite compatibility/schema tests passed. Isolated local world and its successful screenshot are retained outside the repository. Live deployment is pending an empty-server restart or user authorization because popinon connected during testing. No live pack files were changed by the empty-server preflight.
