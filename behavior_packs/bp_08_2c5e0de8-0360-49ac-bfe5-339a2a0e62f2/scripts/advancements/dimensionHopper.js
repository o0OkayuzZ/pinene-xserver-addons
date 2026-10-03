import { world } from "@minecraft/server";
import { advancementsEnabled, grantAdvancement } from "advancements.js";

const dimensionHopperTags = [
  "adv:visited_spider_cave",
  "adv:visited_ancient_crypt",
  "adv:visited_slimy_sewer",
  "adv:visited_mushroom_dimension",
  "adv:visited_woodland_mansion",
  "adv:visited_creepy_stronghold",
  "adv:visited_faraway_fortress",
  "adv:visited_obsidian_fortress",
  "adv:visited_corrupted_jungle",
  "adv:visited_lower_forge",
  "adv:visited_woodland_prison",
  "adv:visited_misty_peak",
  "adv:visited_grand_bastion",
  "adv:visited_desert_tomb",
  "adv:visited_forgotten_citadel",
  "adv:visited_ominous_castle",
  "adv:visited_deepsea_monument",
  "adv:visited_pumpkin_forest",
  "adv:visited_silent_woods",
  "adv:visited_soggy_cave",
  "adv:visited_sanctum_summit",
  "adv:visited_cursed_halls",
  "adv:visited_coral_cave",
  "adv:visited_frosted_fjord",
  "adv:visited_soul_ruins",
  "adv:visited_outer_end"
];

world.afterEvents.playerDimensionChange.subscribe((e) => {
  const player = e.player;
  const toDim = e.toDimension;
  if (advancementsEnabled && toDim.id.includes("dungeons:ancientdim_")) {
    if (player.hasTag("adv:dungeons:dimension_hopper")) return;
    const visitTag = toDim.id.replace("dungeons:ancientdim_", "adv:visited_");
    player.addTag(visitTag);
    for (const tag of dimensionHopperTags) if (!player.hasTag(tag)) return;
    grantAdvancement(player, "dungeons:dimension_hopper");
  }
});
