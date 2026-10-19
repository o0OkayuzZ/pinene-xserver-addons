import { world, system, ItemStack, LootItem } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";

export const dimensions = [
  {
    id: "ancient_crypt",
    boss: "grim_guardian",
    runes: ["a", "i", "i"],
    loot: [
      ["longsword", "diamond_longsword", "hawkbrand"],
      ["dark_armour", "titans_shroud_armour"],
      ["grim_armour", "wither_armour"],
    ]
  },
  {
    id: "spider_cave",
    boss: "abominable_weaver",
    runes: ["a", "s", "t"],
    loot: [
      ["double_axe", "cursed_axe", "whirlwind"],
      ["trickbow", "the_green_menace", "the_pink_scoundrel"],
      ["wolf_armour", "fox_armour", "black_wolf_armour"],
      ["battle_armour", "splendid_armour"],
    ]
  },
  {
    id: "cursed_halls",
    boss: "ancient_terror",
    runes: ["a", "o", "s", "u"],
    loot: [
      ["exploding_crossbow", "firebolt_thrower", "imploding_crossbow"],
      ["champions_armour", "heros_armour"],
      ["mystery_armour"],
    ]
  },
  {
    id: "soul_ruins",
    boss: "haunted_caller",
    runes: ["a", "r", "r"],
    loot: [
      ["sickles", "the_last_laugh", "nightmares_bite"],
      ["longbow", "guardian_bow", "red_snake"],
      ["rapid_crossbow", "auto_crossbow", "butterfly_crossbow"],
      ["spelunker_armour", "cave_crawler_armour"],
    ]
  },
  {
    id: "frosted_fjord",
    boss: "frostwarden",
    runes: ["r", "s", "u"],
    loot: [
      ["snow_bow", "winters_touch"],
      ["snow_armour", "frost_armour"],
    ]
  },
  {
    id: "slimy_sewer",
    boss: "oozing_menace",
    runes: ["c", "r", "u"],
    loot: [
      ["battlestaff", "battlestaff_of_terror", "growing_staff"],
      ["shortbow", "purple_storm", "mechanical_shortbow", "love_spell_bow"],
      ["mercenary_armour", "renegade_armour"]
    ]
  },
  {
    id: "pumpkin_forest",
    boss: "the_tiny_scourge",
    runes: ["c", "c", "o", "t"],
    loot: [
      ["daggers", "moon_daggers", "frost_knives", "sheer_daggers"],
      ["soul_armour", "souldancer_armour"],
      ["thief_armour", "spider_armour"]
    ]
  },
  {
    id: "silent_woods",
    boss: "the_tower",
    runes: ["o", "p", "u", "u"],
    loot: [
      ["sharpened_pickaxe", "sharpened_diamond_pickaxe", "the_monkey_motivator"],
      ["hunting_bow", "ancient_bow", "masters_bow", "hunters_promise"],
      ["beenest_armour", "beehive_armour"],
    ]
  },
  {
    id: "mushroom_dimension",
    boss: "ancient_mooshroom",
    runes: ["a", "c", "i", "p"],
    loot: [
      ["gauntlets", "fighters_bindings", "maulers", "soul_fists"],
      ["katana", "dark_katana", "masters_katana"],
      ["dual_crossbows", "baby_crossbows", "spellbound_crossbows"],
      ["ghostly_armour", "ghost_kindler_armour"],
    ]
  },
  {
    id: "desert_tomb",
    boss: "cursed_presence",
    runes: ["c", "i", "o"],
    loot: [
      ["cutlass", "dancers_sword", "nameless_blade"],
      ["soul_crossbow", "feral_soul_crossbow", "voidcaller"],
      ["phantom_armour", "frost_bite_armour"],
    ]
  },
  {
    id: "ominous_castle",
    boss: "barrage",
    runes: ["o", "r", "r"],
    loot: [
      ["bonebow", "twin_bow"],
      ["soul_bow", "bow_of_lost_souls", "nocturnal_bow"],
      ["hunters_armour", "archers_armour"],
    ]
  },
  {
    id: "faraway_fortress",
    boss: "the_unending",
    runes: ["t", "u", "u"],
    loot: [
      ["boneclub", "bone_cudgel"],
      ["twisting_vine_bow", "weeping_vine_bow"],
      ["piglin_armour", "golden_piglin_armour"],
    ]
  },
  {
    id: "corrupted_jungle",
    boss: "thundering_growth",
    runes: ["c", "c", "u"],
    loot: [
      ["whip", "vine_whip"],
      ["ocelot_armour", "shadow_walker_armour"],
      ["root_rot_armour", "black_spot_armour"],
    ]
  },
  {
    id: "woodland_mansion",
    boss: "first_enchanter",
    runes: ["o", "s", "s"],
    loot: [
      ["claymore", "broadsword", "heartstealer", "great_axeblade"],
      ["soul_scythe", "jailors_scythe", "frost_scythe"],
      ["scale_mail_armour", "highland_armour"],
    ]
  },
  {
    id: "woodland_prison",
    boss: "seeking_flame",
    runes: ["o", "o"],
    loot: [
      ["axe", "firebrand", "highlands_axe"],
      ["soul_knife", "eternal_knife", "truthseeker"],
      ["evocation_armour", "ember_armour", "verdant_armour"]
    ]
  },
  {
    id: "coral_cave",
    boss: "vengeful_mariner",
    runes: ["s", "s", "t"],
    loot: [
      ["anchor", "encrusted_anchor"],
      ["bubble_bow", "bubble_burster"],
      ["turtle_armour", "nimble_turtle_armour"],
    ]
  },
  {
    id: "misty_peak",
    boss: "windbeard",
    runes: ["a", "a", "u"],
    loot: [
      ["tempest_knife","chill_gale_knife","resolute_tempest_knife"],
      ["wind_bow", "burst_gale_bow", "echo_of_the_valley"],
      ["climbing_armour", "rugged_climbing_armour", "goat_armour"],
      ["emerald_armour", "opulent_armour", "gilded_glory_armour"]
    ]
  },
  {
    id: "creepy_stronghold",
    boss: "scuttling_torment",
    runes: ["a", "a", "c", "i"],
    loot: [
      ["obsidian_claymore", "starless_night"],
      ["void_bow", "call_of_the_void"],
      ["teleportation_armour", "unstable_armour"],
    ]
  },
  {
    id: "grand_bastion",
    boss: "unstoppable_tusk",
    runes: ["a", "i", "r"],
    loot: [
      ["broken_sawblade", "mechanised_sawblade"],
      ["cog_crossbow", "pride_of_the_piglins"],
      ["sprout_armour", "living_vines_armour"],
    ]
  },
  {
    id: "deepsea_monument",
    boss: "abyssal_eye",
    runes: ["c", "i", "t"],
    loot: [
      ["coral_blade", "sponge_striker"],
      ["harpoon_crossbow", "nautical_crossbow"],
      ["squid_armour", "glow_squid_armour"],
    ]
  },
  {
    id: "sanctum_summit",
    boss: "vigilant_scoundrel",
    runes: ["c", "t", "u"],
    loot: [
      ["mace", "suns_grace", "flail"],
      ["azure_seeker", "the_slicer"],
      ["reinforced_mail_armour", "stalwart_armour"]
    ]
  },
  {
    id: "soggy_cave",
    boss: "pestilent_conjurer",
    runes: ["c","i","r"],
    loot: [
      ["glaive", "grave_bane", "venom_glaive"],
      ["rush_spear", "fortune_spear", "whispering_spear"],
      ["heavy_Crossbow", "doom_crossbow", "slayer_crossbow"],
      ["scatter_crossbow", "harp_crossbow", "lightning_harp_crossbow"]
    ]
  },
  {
    id: "lower_forge",
    boss: "unbreakable_one",
    runes: ["i", "t", "t"],
    loot: [
      ["claymore", "broadsword", "heartstealer", "great_axeblade"],
      ["great_hammer", "stormlander", "hammer_of_gravity"],
      ["power_bow", "elite_power_bow", "sabrewing"],
      ["plate_armour", "full_metal_armour"]
    ]
  },
  {
    id: "forgotten_citadel",
    boss: "watcher_of_the_end",
    runes: ["c","t","u"],
    loot: [
      ["void_touched_blades", "the_beginning_and_the_end"],
      ["shadow_crossbow", "veiled_crossbow"],
      ["entertainer_armour", "troubadour_armour"]
    ]
  },
  {
    id: "obsidian_fortress",
    boss: "solemn_giant",
    runes: ["p", "r", "s", "t"],
    loot: [
      ["rapier", "bee_stinger", "freezing_foil"],
      ["burst_crossbow", "corrupted_crossbow", "soul_hunter_crossbow"],
      ["guard_armour", "ender_armour"]
    ]
  },
  {
    id: "outer_end",
    boss: "the_swarm",
    runes: ["c","c","r", "s"],
    loot: [
      ["backstabber", "swift_striker"],
      ["shadow_crossbow", "veiled_crossbow"],
      ["shulker_armour", "sturdy_shulker_armour"]
    ]
  }
];

function fixId(id) {
  id = id.replace("dungeons:", "").replace("armour", "helmet");
  if (id == "longsword") return "sword";
  if (id == "diamond_longsword") return "diamond_sword";
  return id;
}

world.afterEvents.playerDimensionChange.subscribe((e) => {
    const dim = e.toDimension;
    const player = e.player;
    if(dim.id.includes("dungeons:ancientdim_")) player.addTag("dungeons:boa_" + dim.id.replace("dungeons:ancientdim_",""))
})

system.beforeEvents.startup.subscribe((e) => {
  e.itemComponentRegistry.registerCustomComponent("dungeons:book_of_ancients", {
    onUse(e) {
      const player = e.source;
      const form = new ActionFormData();
      form.title({ translate: e.itemStack.localizationKey });
      form.body({ translate: "dungeons.boa.body" });
      var unlockedCount = 0
      const buttonArray = [];
        for (const dimension of dimensions) {
        if(player.hasTag("dungeons:boa_" + dimension.id)) {
            unlockedCount += 1
        }
      }
      form.label(`${percentageColour(unlockedCount, dimensions.length)}${unlockedCount}/${dimensions.length}`)
      if(unlockedCount > 0) {
        form.divider()
        form.label({ translate: "dungeons.boa.unlocked_dimensions" });
        form.divider()
      }
      for (const dimension of dimensions) {
        if(player.hasTag("dungeons:boa_" + dimension.id)) {
            if(player.hasTag("dungeons:boa_defeated_" + dimension.boss)) {
                form.button({ translate: "dungeons.dimension." + dimension.id }, "textures/ui/form/dimensions/completed/" + dimension.id)
                buttonArray.push([dimension, "completed"])

            } else {
                form.button({ translate: "dungeons.dimension." + dimension.id }, "textures/ui/form/dimensions/discovered/" + dimension.id)
                buttonArray.push([dimension, "discovered"])
            }
        }
      }
      if(unlockedCount < dimensions.length) {
        form.divider()
        form.label({ translate: "dungeons.boa.locked_dimensions" });
        form.divider()
      }

      for (const dimension of dimensions) {
        if(!player.hasTag("dungeons:boa_" + dimension.id)) {
            var runeString = "";
            for (const rune of dimension.runes) runeString += runeIcon(rune);
            form.button(runeString, "textures/ui/form/dimensions/locked/" + dimension.id)
            buttonArray.push([dimension, "locked"])
        }
      }

      form.show(player).then((r) => {
        player.playSound("item.book.page_turn");
        if (r.canceled) return;
        const selection = buttonArray[r.selection]
        if(selection[1] == "locked") makeLockedPage(player, selection[0])
        if(selection[1] == "discovered") makeDimensionPage(player, selection[0], false)
        if(selection[1] == "completed") makeDimensionPage(player, selection[0], true)
      });
    },
  });
});

function percentageColour(count, max, player) {
    var pct = count / max
    if (pct <= 0.25) return "§c"
    if (pct > 0.25 && pct <= 0.5) return "§v"
    if (pct > 0.5 && pct <= 0.75) return "§6"
    if (pct > 0.75 && pct < 1) return "§e"
    if (pct >= 1) return "§a"
}

function makeLockedPage(player, dimensionCheck) {
  const form = new ActionFormData();
  form.title({ translate: "dungeons.boa.locked.title" });
  form.body({ translate: "dungeons.boa.locked.body" });
  var runeString = "";
  for (const rune of dimensionCheck.runes) runeString += runeIcon(rune);
  form.label("");
  form.label(runeString);
  form.label("");
  form.label("");
  form.label("");
  form.button({ translate: "dungeons.boa.okay" });
  form.show(player).then((r) => {
    player.playSound("item.book.page_turn");
    if (r.canceled) return;
  });

}

function makeDimensionPage(player, dimensionCheck, bossCleared) {
  const form = new ActionFormData();
  form.title({ translate: "dungeons.dimension." + dimensionCheck.id });
  form.body({translate: "dungeons.dimension.description." + dimensionCheck.id});
  form.divider()
  var runeString = "";
  for (const rune of dimensionCheck.runes) runeString += runeIcon(rune);
  form.label(runeString);
  
  if(bossCleared) {
    form.label({rawtext:[{translate: "dungeons.boa.ancient"}, {text: " "}, {translate: "entity.dungeons:" + dimensionCheck.boss + ".name"}]})
    form.label({rawtext:[{text:"§l§o§g"},{translate: "dungeons.boa.ancient_loot_table"}]})
    for (const itemGroup of dimensionCheck.loot) {
        form.divider();
        var uniqueCount = 0;
        for (const item of itemGroup) {
        const itemStackCheck = new ItemStack("dungeons:" + fixId(item), 1);
        if (itemStackCheck.hasTag("dungeons:unique_item")) uniqueCount += 1;
        }
        for (const item of itemGroup) {
            const itemStackCheck = new ItemStack("dungeons:" + fixId(item), 1);
            const unique = itemStackCheck.hasTag("dungeons:unique_item")
            var groupDiv = 1 / (dimensionCheck.loot.length * 1.5);
            var colour = "§7"
            if (unique) {
                groupDiv = groupDiv / (uniqueCount * 2);
                colour = "§6"
            }
            var percentage = Math.round(groupDiv * 1000)/10;
            if(player.hasTag("boh_collected:dungeons:" + item.replace("dungeons:", ""))) {
                form.label({
                    rawtext: [
                    { text: `${colour}${percentage}` + "%%    " },
                    {
                        translate:
                        "dungeons.boh.title." +
                        item.replace("dungeons:", "").replace("_armour", ""),
                    }
                    ],
                });
            } else {
                colour = "§c"
                form.label({
                    rawtext: [
                    { text: `${colour}${percentage}` + "%%    " },
                    {
                        translate:
                        "???",
                    }
                    ],
                });
            }
        }
    }
  } else {
    form.label({rawtext:[{translate: "dungeons.boa.ancient_unknown"}]})
    form.label({rawtext:[{translate: "dungeons.boa.ancient_unknown.body"}]})
    form.divider()
  }
  form.button({ translate: "dungeons.boh.close" });
  form.show(player).then((r) => {
    player.playSound("item.book.page_turn");
    if (r.canceled) return;
  });
}

function runeIcon(rune) {
  const icons = { u: "\uE901", t: "\uE902", s: "\uE903", r: "\uE904", p: "\uE905", o: "\uE906", i: "\uE907", c: "\uE908", a: "\uE909" };
  return icons[rune] ?? `§e[${String(rune).toUpperCase()}]§r `;
}
