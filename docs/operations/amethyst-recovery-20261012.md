# Budding amethyst recovery

The active server and canonical repository contain no recovery handler for minecraft:budding_amethyst. History searches only found item digger speed entries and inventory icon metadata; the previous successful recovery path could not be established.

The inherited loot_tables/blocks/amethyst_crystal_block.json references a nonexistent wx:amethyst_crystal_block. Native Bedrock loot-mine tests showed that merely correcting that table does not change vanilla budding-amethyst drops. The unused inherited table is preserved and is not claimed as the root cause. A control amethyst_block yielded one native item, while budding_amethyst yielded none with plain, silk-touch or fortune diamond pickaxes.

Add a handler to the successful playerBreakBlock after-event: survival/adventure, doTileDrops enabled, broken native budding_amethyst, and a pickaxe carrying silk_touch. Use itemStackBeforeBreak so the last durability use still qualifies. Spawn exactly one native budding_amethyst. No before-event cancellation, tool durability rewrite, repeating scan, custom block replacement, loot-table alias or texture edit. Creative/spectator, plain/fortune tools, explosions, commands and unrelated blocks do not receive extra drops. Cancelled protection checks never fire the after-event.

This is a server-specific silk-touch recovery feature; vanilla Minecraft does not provide it. The user was asked what tool previously failed; no answer was available when this default was prepared. Ordinary amethyst and other geode budding ores retain their own behavior.

The existing pending integrated BP version 1.0.82 covers this change together with the trader/llama fixes. Production was applied after confirming zero players; GitHub main awaits PR #41 merge approval.

Real Bedrock v26.52 player-break verification passed in an isolated local world: silk touch -> one minecraft:budding_amethyst; plain -> none; fortune III -> none; ordinary amethyst -> one minecraft:amethyst_block; creative -> none; doTileDrops false -> none. Four policy regression tests and the eight trader/llama tests also passed. Mining haste was used only in the isolated test world to automate the click, never in the production handler.

Deployment update (2026-10-12 JST): confirmed 0 players and applied all three fixes with backup /opt/minecraft/server/_pinene_deploy_backups/trader-llama-20261011T160302Z. All 145 food RP files verified unchanged. Production integrated BP 1.0.82 / RP 1.0.70 / outline RP 1.0.7. GitHub main still awaits PR #41 merge approval; no recurring unattended automation was created.
