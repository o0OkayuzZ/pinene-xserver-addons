import { world, system } from "@minecraft/server";

const componentId = `dungeons:ancient_hunt_mob`;

const chunkSpawnDist = 6;

system.beforeEvents.startup.subscribe((initEvent) => {
  initEvent.blockComponentRegistry.registerCustomComponent(componentId, {
    onTick(blockEvent, paramters) {
      const { block, dimension } = blockEvent;
      if (!dimension.isChunkLoaded(block.location)) {
        return;
      }
      const playerNear = dimension.getPlayers({
        location: block.location,
        maxDistance: 16 * chunkSpawnDist,
      });
      if (playerNear.length < 1) return;
      const type = paramters.params.type;
      const group = paramters.params.group;
      var chance = paramters.params.chance;
      if (chance == undefined) chance = 1;
      var isInWater = false
      if(block.above().typeId == "minecraft:water") {
        block.setType("water");
        isInWater = true
      } else {
        block.setType("air");
      }
      if (world.getDifficulty() == "Peaceful") return;

      if (!type || !group) return;
      //world.sendMessage(`${type} ${group}`)
      var mobSpawns = 0;
      var spawnRadius = 0;
      if (group == "small") {
        mobSpawns = 2 + Math.round(Math.random());
        spawnRadius = 2;
      } else if (group == "large") {
        mobSpawns = 2 + Math.round(Math.random() * 3);
        spawnRadius = 4;
      }
      if (type == "mushroom_dimension") spawnRadius = spawnRadius * 0.33;
      if (type == "obsidian_fortress") spawnRadius = spawnRadius * 0.5;
      if (type == "misty_peak") spawnRadius = spawnRadius * 0.33;
      if (type == "pumpkin_forest") spawnRadius = spawnRadius * 0.33;
      if (type == "silent_woods") spawnRadius = spawnRadius * 0.33;
      if (type == "outer_end") spawnRadius = spawnRadius * 0.33;
      mobSpawns = Math.ceil(mobSpawns);
      const reducers = [
        "grand_bastion",
        "cursed_halls",
        "faraway_fortress",
        "outer_end",
        "soul_ruins"
      ]
      if (reducers.includes(type) && group == "large" && mobSpawns > 1) mobSpawns -= 1;
      if (world.getDifficulty() == "Hard") mobSpawns += 1;
      if (
        Math.random() > 0.85 &&
        mobSpawns > 1 &&
        world.getDifficulty() == "Easy"
      )
        mobSpawns -= 1;

      if(world.getDifficulty() == "Hard" || (world.getDifficulty() == "Normal" && Math.random() > 0.5)) {
        if ((type == "slimy_sewer" || type == "soul_ruins") && (block.y < 45 || block.y > 75)) chance = chance / 2
        if ((type !== "slimy_sewer" && type !== "soul_ruins" && type !== "misty_peak"  && type !== "obsidian_fortress"  && type !== "outer_end"  && type !== "sanctum_summit") && (block.y < 45 || block.y > 85)) chance = chance * 0.8
      }
      if(world.getDifficulty() == "Hard" && Math.random() > 0.98 && group == "small") mobSpawns += mobSpawns
      for (let i = 0; i < mobSpawns; i++) {
        if (Math.random() > chance) continue;
        system.runTimeout(() => {
          const x = Math.random() * spawnRadius - spawnRadius / 2;
          const z = Math.random() * spawnRadius - spawnRadius / 2;
          var spawnLoc = {
            x: block.bottomCenter().x + x,
            y: block.bottomCenter().y,
            z: block.bottomCenter().z + z,
          };
          if (
            dimension.getTopmostBlock(
              { x: spawnLoc.x, z: spawnLoc.z },
              spawnLoc.y,
            ) == undefined
          ) {
            spawnLoc = block.bottomCenter();
          }
          if (
            dimension.getBlock(spawnLoc) &&
            type == "mushroom_dimension" &&
            dimension.getBlock(spawnLoc).below().isAir
          )
            spawnLoc = block.bottomCenter();
          const spawnOptions = [];
          for (const spawn of spawnData) {
            if (spawn.type !== type) continue;
            if (spawn.groups.includes(group) == false) continue;
            if (spawn.requireWater == true && isInWater == false) continue;
            if (spawn.excludeWater == true && isInWater == true) continue;
            if (spawn.weight >= 1) {
              for (let j = 0; j < Math.ceil(spawn.weight); j++) {
                spawnOptions.push([
                  spawn.entity,
                  spawn.always_spawn,
                  spawn.event,
                  spawn.headgear,
                ]);
              }
            } else {
              if (Math.random() < spawn.weight) {
                spawnOptions.push([
                  spawn.entity,
                  spawn.always_spawn,
                  spawn.event,
                  spawn.headgear,
                ]);
              }
            }
          }
          var spawn =
            spawnOptions[Math.floor(Math.random() * spawnOptions.length)];
          if (
            Math.random() < 0.01 &&
            dimension.getEntities({
              type: "dungeons:piggy_bank",
              location: block.center(),
              maxDistance: 250,
            }).length == 0 && type !== "deepsea_monument" && !isInWater
          ) {
            spawn = ["dungeons:piggy_bank", false];
          }
          if (spawn[1] == true || world.gameRules.doMobSpawning == true) {
            try {
              var spawnEvent = "minecraft:entity_spawned";
              if (spawn[2]) spawnEvent = spawn[2];
              var headGear = undefined;
              if (spawn[3]) headGear = spawn[3];
              const mob = dimension.spawnEntity(
                spawn[0],
                block.bottomCenter(),
                { initialPersistence: true, spawnEvent: spawnEvent },
              );
              if (mob.isValid) {
                mob.tryTeleport(spawnLoc, { checkForBlocks: true });
                mob.addTag("dungeons:ancient_hunt");
                mob.addTag("dungeons:ancient_hunt_" + type);
                system.runTimeout(() => {
                  if (mob.isValid && dimension.isChunkLoaded(mob.location)) {
                    if (mob.location.y < spawnLoc.y - 1) mob.teleport(spawnLoc);
                  }
                }, 50);
                if (headGear) {
                  mob.runCommand(
                    "replaceitem entity @s slot.armor.head 0 " + headGear,
                  );
                }
              }
            } catch {}
          }
        }, i);
      }
    },
  });
});

const spawnData = [
  {
    type: "spider_cave",
    groups: ["small", "large"],
    entity: "minecraft:cave_spider",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["small"],
    entity: "minecraft:zombie",
    weight: 40,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "minecraft:zombie",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "minecraft:skeleton",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "dungeons:necromancer",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "dungeons:vanguard",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "dungeons:monster_spawner",
    weight: 2,
    always_spawn: false,
    event: "dungeons:spawn_as_zombie_spawner",
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "minecraft:husk",
    weight: 4,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "minecraft:slime",
    weight: 4,
    always_spawn: false,
  },
  {
    type: "spider_cave",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 1,
    always_spawn: false,
  },

  //crypt
  {
    type: "ancient_crypt",
    groups: ["small", "large"],
    entity: "minecraft:husk",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 35,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["small"],
    entity: "minecraft:skeleton",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["large"],
    entity: "minecraft:skeleton",
    weight: 25,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["large"],
    entity: "minecraft:slime",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["large"],
    entity: "dungeons:necromancer",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["small"],
    entity: "dungeons:necromancer",
    weight: 3,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["large"],
    entity: "minecraft:vindicator",
    weight: 7,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["large"],
    entity: "minecraft:spider",
    weight: 9,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 9,
    always_spawn: false,
  },
  {
    type: "ancient_crypt",
    groups: ["large"],
    entity: "minecraft:skeleton_horse",
    weight: 0.15,
    always_spawn: false,
    event: "minecraft:set_trap",
  },

  //sewer
  {
    type: "slimy_sewer",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 22,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["large"],
    entity: "dungeons:jungle_zombie",
    weight: 22,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["small", "large"],
    entity: "minecraft:drowned",
    weight: 22,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["small", "large"],
    entity: "minecraft:slime",
    weight: 25,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["large"],
    entity: "minecraft:bogged",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["large"],
    entity: "dungeons:necromancer",
    weight: 4,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["small", "large"],
    entity: "minecraft:cave_spider",
    weight: 9,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 9,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["large"],
    entity: "dungeons:drowned_necromancer",
    weight: 0.4,
    always_spawn: false,
  },
  {
    type: "slimy_sewer",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 0.4,
    always_spawn: false,
  },

  // ??????????????????????????

  {
    type: "mushroom_dimension",
    groups: ["small"],
    entity: "dungeons:ancient_hunt_mooshroom",
    weight: 140,
    always_spawn: false,
  },
  {
    type: "mushroom_dimension",
    groups: ["large"],
    entity: "dungeons:ancient_hunt_mooshroom",
    weight: 90,
    always_spawn: false,
  },
  {
    type: "mushroom_dimension",
    groups: ["small"],
    entity: "dungeons:enchanted_ancient_hunt_mooshroom",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "mushroom_dimension",
    groups: ["large"],
    entity: "dungeons:enchanted_ancient_hunt_mooshroom",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "mushroom_dimension",
    groups: ["large"],
    entity: "minecraft:mooshroom",
    weight: 1,
    always_spawn: false,
  },

  //woodland mansion

  {
    type: "woodland_mansion",
    groups: ["small", "large"],
    entity: "minecraft:vindicator",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 45,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["small", "large"],
    entity: "dungeons:vindicator_chef",
    weight: 8,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["large"],
    entity: "dungeons:royal_guard",
    weight: 6,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["large"],
    entity: "minecraft:evocation_illager",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["large"],
    entity: "dungeons:geomancer",
    weight: 6,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["large"],
    entity: "dungeons:illusioner",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "woodland_mansion",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 15,
    always_spawn: false,
  },
  //creepy stronghold
  {
    type: "creepy_stronghold",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 35,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["small", "large"],
    entity: "dungeons:ancient_hunt_silverfish",
    weight: 35,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["small"],
    entity: "minecraft:endermite",
    weight: 11,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["large"],
    entity: "dungeons:necromancer",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["large"],
    entity: "dungeons:wraith",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "creepy_stronghold",
    groups: ["large"],
    entity: "dungeons:endersent",
    weight: 0.1,
    always_spawn: false,
  },

  //faraway fortress

  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "minecraft:wither_skeleton",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["small", "large"],
    entity: "minecraft:blaze",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "minecraft:magma_cube",
    weight: 10,
    always_spawn: false,
    event: "spawn_medium",
  },
  {
    type: "faraway_fortress",
    groups: ["small", "large"],
    entity: "minecraft:magma_cube",
    weight: 15,
    always_spawn: false,
    event: "spawn_small",
  },
  {
    type: "faraway_fortress",
    groups: ["small", "large"],
    entity: "dungeons:vanguard",
    weight: 4,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "dungeons:monster_spawner",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "dungeons:wildfire",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "minecraft:zombie_pigman",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "dungeons:zombified_piglin_fungus_thrower",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "dungeons:zombified_piglin_brute",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "faraway_fortress",
    groups: ["large"],
    entity: "minecraft:hoglin",
    weight: 4,
    always_spawn: false,
    event: "spawn_adult_unhuntable",
  },
  //obsidian fortress

  {
    type: "obsidian_fortress",
    groups: ["small", "large"],
    entity: "minecraft:pillager",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 25,
    always_spawn: false,
    headgear: "dungeons:mercenary_helmet",
  },
  {
    type: "obsidian_fortress",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 15,
    always_spawn: false,
    headgear: "dungeons:mercenary_helmet",
  },
  {
    type: "obsidian_fortress",
    groups: ["large", "small"],
    entity: "minecraft:necromancer",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["small"],
    entity: "minecraft:vindicator",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["large"],
    entity: "minecraft:vindicator",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["large", "small"],
    entity: "dungeons:royal_guard",
    weight: 4,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["large"],
    entity: "minecraft:enderman",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["large"],
    entity: "dungeons:geomancer",
    weight: 6,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["large", "small"],
    entity: "minecraft:creeper",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "obsidian_fortress",
    groups: ["small", "large"],
    entity: "dungeons:redstone_cube",
    weight: 10,
    always_spawn: false,
  },

  //corrupted jungle
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "dungeons:jungle_zombie",
    weight: 30,
    always_spawn: false,
    headgear: "dungeons:guard_helmet",
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 20,
    always_spawn: false,
    headgear: "dungeons:guard_helmet",
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "minecraft:bogged",
    weight: 20,
    always_spawn: false,
    headgear: "dungeons:guard_helmet",
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "dungeons:skeleton",
    weight: 30,
    always_spawn: false,
    headgear: "dungeons:guard_helmet",
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 20,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "minecraft:slime",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["small", "large"],
    entity: "dungeons:vanguardd",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "dungeons:necromancer",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "minecraft:panda",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "dungeons:whisperer",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "dungeons:leapleaf",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["small"],
    entity: "dungeons:poison_quill_vine",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "dungeons:poison_quill_vine",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "dungeons:geomancer",
    weight: 3,
    always_spawn: false,
  },
  {
    type: "corrupted_jungle",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 1,
    always_spawn: false,
  },

  //lower forge
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 30,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 9,
    always_spawn: false,
    headgear: "dungeons:mercenary_helmet",
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 22,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 6,
    always_spawn: false,
    headgear: "dungeons:mercenary_helmet",
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 12,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:wraith",
    weight: 3,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:pillager",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:vindicator",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["large"],
    entity: "dungeons:redstone_cube",
    weight: 11,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "lower_forge",
    groups: ["large"],
    entity: "dungeons:monster_spawner",
    weight: 5,
    always_spawn: false,
    event: "dungeons:spawn_as_zombie_spawner",
  },
  {
    type: "lower_forge",
    groups: ["large"],
    entity: "dungeons:royal_guard",
    weight: 3,
    always_spawn: false,
  },
  //woodland prison

  {
    type: "woodland_prison",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 30,
  },
  {
    type: "woodland_prison",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 25,
  },
  {
    type: "woodland_prison",
    groups: ["small", "large"],
    entity: "minecraft:husk",
    weight: 22,
  },
  {
    type: "woodland_prison",
    groups: ["small", "large"],
    entity: "minecraft:creeper",
    weight: 15,
  },
  {
    type: "woodland_prison",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 15,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "dungeons:necromancer",
    weight: 10,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "dungeons:wraith",
    weight: 10,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "dungeons:tower_wraith",
    weight: 3,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "minecraft:cave_spider",
    weight: 10,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "dungeons:monster_spawner",
    weight: 6,
    always_spawn: false,
    event: "dungeons:spawn_as_zombie_spawner",
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "minecraft:vindicator",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "minecraft:pillager",
    weight: 10,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "minecraft:evocation_illager",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "dungeons:illusioner",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "dungeons:redstone_golem",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large", "small"],
    entity: "dungeons:ancient_hunt_silverfish",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large", "small"],
    entity: "dungeons:enchanted_ancient_hunt_silverfish",
    weight: 2,
    always_spawn: false,
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "minecraft:skeleton_horse",
    weight: 0.15,
    always_spawn: false,
    event: "minecraft:set_trap",
  },
  //misty peaks
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "dungeons:mountaineer",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "dungeons:iceologer",
    weight: 4,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "minecraft:pillager",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "dungeons:frozen_zombie",
    weight: 25,
    always_spawn: false,
    headgear: "minecraft:leather_helmet",
  },
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "minecraft:zombie",
    weight: 30,
    always_spawn: false,
    headgear: "minecraft:leather_helmet",
  },
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "minecraft:stray",
    weight: 18,
    always_spawn: false,
    headgear: "minecraft:leather_helmet",
  },
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "minecraft:skeleton",
    weight: 25,
    always_spawn: false,
    headgear: "minecraft:leather_helmet",
  },
  {
    type: "misty_peak",
    groups: ["small", "large"],
    entity: "minecraft:goat",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "minecraft:creeper",
    weight: 11,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "dungeons:icy_creeper",
    weight: 11,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "dungeons:windcaller",
    weight: 11,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["small"],
    entity: "minecraft:spider",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["small"],
    entity: "minecraft:llama",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "dungeons:squall_golem",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "dungeons:illusioner",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "misty_peak",
    groups: ["large"],
    entity: "minecraft:ravager",
    weight: 1,
    always_spawn: false,
  },
  //grand bastion

  {
    type: "grand_bastion",
    groups: ["small", "large"],
    entity: "minecraft:piglin",
    weight: 25,
    always_spawn: false,
    event: "spawn_adult_no_hunting",
  },

  {
    type: "grand_bastion",
    groups: ["small", "large"],
    entity: "minecraft:piglin",
    weight: 20,
    always_spawn: false,
    headgear: "minecraft:golden_helmet",
    event: "spawn_adult_no_hunting",
  },

  {
    type: "grand_bastion",
    groups: ["large"],
    entity: "minecraft:hoglin",
    weight: 15,
    always_spawn: false,
    event: "spawn_adult_unhuntable",
  },

  {
    type: "grand_bastion",
    groups: ["large"],
    entity: "dungeons:piglin_fungus_thrower",
    weight: 15,
    always_spawn: false,
  },
  {
    type: "grand_bastion",
    groups: ["large"],
    entity: "minecraft:piglin_brute",
    weight: 3,
    always_spawn: false,
  },
  {
    type: "grand_bastion",
    groups: ["small"],
    entity: "minecraft:piglin_brute",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "grand_bastion",
    groups: ["small", "large"],
    entity: "minecraft:blaze",
    weight: 5,
    always_spawn: false,
  },
  {
    type: "grand_bastion",
    groups: ["small", "large"],
    entity: "dungeons:baby_ghast",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "grand_bastion",
    groups: ["large"],
    entity: "dungeons:wildfire",
    weight: 1,
    always_spawn: false,
  },
  {
    type: "grand_bastion",
    groups: ["large"],
    entity: "dungeons:monster_spawner",
    weight: 2,
    always_spawn: false,
  },
  //desert_tomb
  {
    type: "desert_tomb",
    groups: ["large", "small"],
    entity: "minecraft:skeleton",
    weight: 25,
  },
  {
    type: "desert_tomb",
    groups: ["small"],
    entity: "minecraft:parched",
    weight: 12,
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "minecraft:parched",
    weight: 14,
  },
  {
    type: "desert_tomb",
    groups: ["large", "small"],
    entity: "minecraft:husk",
    weight: 25,
  },
  {
    type: "desert_tomb",
    groups: ["small"],
    entity: "minecraft:husk",
    weight: 13,
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "minecraft:husk",
    weight: 25,
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "dungeons:vanguard",
    weight: 13,
  },
  {
    type: "desert_tomb",
    groups: ["small", "large"],
    entity: "dungeons:necromancer",
    weight: 13,
  },
  {
    type: "desert_tomb",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 13,
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "minecraft:cave_spider",
    weight: 13,
  },
  {
    type: "desert_tomb",
    groups: ["small", "large"],
    entity: "dungeons:wraith",
    weight: 5
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "minecraft:pillager",
    weight: 13
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "dungeons:geomancer",
    weight: 5
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "minecraft:creeper",
    weight: 5
  },
  {
    type: "desert_tomb",
    groups: ["large"],
    entity: "dungeons:tower_guard",
    weight: 1
  },
  //forgotten_citadel
  {
    type: "forgotten_citadel",
    groups: ["small", "large"],
    entity: "dungeons:watchling",
    weight: 30
  },
  {
    type: "forgotten_citadel",
    groups: ["small", "large"],
    entity: "dungeons:blastling",
    weight: 5
  },
  {
    type: "forgotten_citadel",
    groups: ["small", "large"],
    entity: "dungeons:snareling",
    weight: 5
  },
  {
    type: "forgotten_citadel",
    groups: ["large"],
    entity: "dungeons:blastling",
    weight: 11
  },
  {
    type: "forgotten_citadel",
    groups: ["large"],
    entity: "dungeons:snareling",
    weight: 11
  },
  {
    type: "forgotten_citadel",
    groups: ["large"],
    entity: "minecraft:enderman",
    weight: 4
  },
  {
    type: "forgotten_citadel",
    groups: ["small", "large"],
    entity: "minecraft:endermite",
    weight: 20
  },
  {
    type: "forgotten_citadel",
    groups: ["small", "large"],
    entity: "minecraft:pillager",
    weight: 8
  },
  {
    type: "forgotten_citadel",
    groups: ["small", "large"],
    entity: "minecraft:vindicator",
    weight: 8
  },
  {
    type: "forgotten_citadel",
    groups: ["large"],
    entity: "dungeons:endersent",
    weight: 1
  },
  {
    type: "forgotten_citadel",
    groups: ["large"],
    entity: "minecraft:shulker",
    weight: 2
  },
  //ominous_castle
  {
    type: "ominous_castle",
    groups: ["small"],
    entity: "minecraft:zombie",
    weight: 23
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "minecraft:zombie",
    weight: 9
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "minecraft:zombie",
    weight: 14,
    headgear: "dungeons:mercenary_helmet",
  },
    {
    type: "ominous_castle",
    groups: ["small"],
    entity: "minecraft:skeleton",
    weight: 23
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "minecraft:skeleton",
    weight: 9
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "minecraft:skeleton",
    weight: 14,
    headgear: "dungeons:mercenary_helmet",
  },
  {
    type: "ominous_castle",
    groups: ["small", "large"],
    entity: "minecraft:vindicator",
    weight: 8
  },
  {
    type: "ominous_castle",
    groups: ["small", "large"],
    entity: "minecraft:pillager",
    weight: 16
  },
  {
    type: "ominous_castle",
    groups: ["small", "large"],
    entity: "dungeons:vindicator_chef",
    weight: 4
  },
  {
    type: "ominous_castle",
    groups: ["small", "large"],
    entity: "dungeons:wraith",
    weight: 5
  },
  {
    type: "ominous_castle",
    groups: ["small", "large"],
    entity: "minecraft:spider",
    weight: 10
  },
  {
    type: "ominous_castle",
    groups: ["small", "large"],
    entity: "dungeons:necromancer",
    weight: 5
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "dungeons:royal_guard",
    weight: 4
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "dungeons:tower_guard",
    weight: 3
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "minecraft:evoker",
    weight: 1
  },
  {
    type: "ominous_castle",
    groups: ["large"],
    entity: "minecraft:creeper",
    weight: 5
  },
  {
    type:"ominous_castle",
    groups:["large"],
    entity: "dungeons:redstonee_golem",
    weight:1
  },
  //deepsea_monument
  {
    type: "deepsea_monument",
    groups: ["small", "large"],
    entity: "minecraft:drowned",
    weight: 25
  },
  {
    type: "deepsea_monument",
    groups: ["small", "large"],
    entity: "dungeons:sunken_skeleton",
    weight: 20
  },
  {
    type: "deepsea_monument",
    groups: ["small", "large"],
    entity: "minecraft:guardian",
    weight: 10
  },
  {
    type: "deepsea_monument",
    groups: ["small", "large"],
    entity: "minecraft:glow_squid",
    weight: 1
  },
  {
    type: "deepsea_monument",
    groups: ["large"],
    entity: "dungeons:drowned_necromancer",
    weight: 1
  },
  {
    type: "deepsea_monument",
    groups: ["large"],
    entity: "minecraft:elder_guardian",
    weight: 1
  },
  //pumpkin_forest
  {
    type:"pumpkin_forest",
    groups:["small", "large"],
    entity: "minecraft:zombie",
    weight:22,
    headgear: "dungeons:guard_helmet"
  },
  {
    type:"pumpkin_forest",
    groups:["small"],
    entity: "minecraft:zombie",
    weight:15,
    headgear: "minecraft:leather_helmet",
    event: "minecraft:entity_born"
  },
  {
    type:"pumpkin_forest",
    groups:["small", "large"],
    entity: "minecraft:skeleton",
    weight:20,
    headgear: "dungeons:guard_helmet"
  },
  {
    type:"pumpkin_forest",
    groups:["small", "large"],
    entity: "minecraft:spider",
    weight:21
  },
  {
    type:"pumpkin_forest",
    groups:["small", "large"],
    entity: "minecraft:creper",
    weight:15
  },
  {
    type:"pumpkin_forest",
    groups:["large"],
    entity: "minecraft:pillager",
    weight:13
  },
  {
    type:"pumpkin_forest",
    groups:["small", "large"],
    entity: "dungeons:mountaineer",
    weight:9
  },
  {
    type:"pumpkin_forest",
    groups:["large"],
    entity: "minecraft:vindicator",
    weight:5
  },
  {
    type:"pumpkin_forest",
    groups:["large"],
    entity: "minecraft:fox",
    weight:1
  },
  {
    type:"pumpkin_forest",
    groups:["large"],
    entity: "dungeons:geomancer",
    weight:5
  },
  {
    type:"pumpkin_forest",
    groups:["large"],
    entity: "dungeons:evoker",
    weight:1
  },
  {
    type:"pumpkin_forest",
    groups:["large"],
    entity: "dungeons:rolling_flame",
    weight:1
  },
  //silent_woods
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:zombie",
    weight:25,
    headgear: "dungeons:guard_helmet"
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:skeleton",
    weight:25,
    headgear: "dungeons:guard_helmet"
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:creeper",
    weight:10
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:spider",
    weight:12
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:cave_spider",
    weight:12
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:witch",
    weight:4
  },
  {
    type:"silent_woods",
    groups:["large"],
    entity: "dungeons:vanguard",
    weight:8
  },
  {
    type:"silent_woods",
    groups:["large"],
    entity: "dungeons:wraith",
    weight:8
  },
  {
    type:"silent_woods",
    groups:["large"],
    entity: "dungeons:tower_wraith",
    weight:3
  },
  {
    type:"silent_woods",
    groups:["large"],
    entity: "dungeons:tower_guard",
    weight:3
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:pillager",
    weight:10
  },
  {
    type:"silent_woods",
    groups:["small", "large"],
    entity: "minecraft:chicken",
    weight:1
  },
  {
    type:"silent_woods",
    groups:["large"],
    entity: "dungeons:endersent",
    weight:1
  },
  {
    type: "woodland_prison",
    groups: ["large"],
    entity: "minecraft:skeleton_horse",
    weight: 0.5,
    always_spawn: false,
    event: "minecraft:set_trap",
  },
  //
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:zombie",
    weight:15
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:skeleton",
    weight:15
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "dungeons:jungle_zombie",
    weight:11
  },
  {
    type:"soggy_cave",
    groups:["large"],
    entity: "minecraft:bogged",
    weight:11
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:spider",
    weight:11
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:cave_spider",
    weight:6
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:drowned",
    weight:12
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:creeper",
    weight:10
  },
  {
    type:"soggy_cave",
    groups:["large"],
    entity: "minecraft:slime",
    weight:10
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:witch",
    weight:6
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "minecraft:pillager",
    weight:6
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "dungeons:vanguard",
    weight:6
  },
  {
    type:"soggy_cave",
    groups:["large"],
    entity: "dungeons:necromancer",
    weight:8
  },
  {
    type:"soggy_cave",
    groups:["large"],
    entity: "dungeons:wraith",
    weight:6
  },
  {
    type:"soggy_cave",
    groups:["large"],
    entity: "dungeons:redstone_golem",
    weight:1
  },
  {
    type:"soggy_cave",
    groups:["small", "large"],
    entity: "dungeons:drowned_necromancer",
    weight:1
  },
  //sanctum summitttttttttttttttttt :>
  {
    type:"sanctum_summit",
    groups:["small", "large"],
    entity: "dungeons:mountaineer",
    weight:15
  },
  {
    type:"sanctum_summit",
    groups:["small", "large"],
    entity: "minecraft:pillager",
    weight:15
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "minecraft:vindicator",
    weight:8
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "dungeons:royal_guard",
    weight:4
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "dungeons:tower_guard",
    weight:4
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "dungeons:windcaller",
    weight:5
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "minecraft:evoker",
    weight:1
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "minecraft:ravager",
    weight:1
  },
  {
    type:"sanctum_summit",
    groups:["small", "large"],
    entity: "minecraft:stray",
    weight:10
  },
  {
    type:"sanctum_summit",
    groups:["small", "large"],
    entity: "dungeons:frozen_zombie",
    weight:10
  },
  {
    type:"sanctum_summit",
    groups:["small", "large"],
    entity: "dungeons:icy_creeper",
    weight:5
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "dungeons:redstone_golem",
    weight:1
  },
  {
    type:"sanctum_summit",
    groups:["small", "large"],
    entity: "dungeons:squall_golem",
    weight:3
  },
  {
    type:"sanctum_summit",
    groups:["large"],
    entity: "minecraft:breeze",
    weight:3
  },
  //cursd halls
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "minecraft:skeleton",
    weight:22
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "minecraft:zombie",
    weight:25
  },
  {
    type:"cursed_halls",
    groups:["large"],
    entity: "minecraft:zombie",
    weight:5,
    headgear: "dungeons:soul_helmet",
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "dungeons:ancient_hunt_silverfish",
    weight:10
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "minecraft:pillager",
    weight:12
  },
  {
    type:"cursed_halls",
    groups:["large"],
    entity: "minecraft:vindicator",
    weight:5
  },
  {
    type:"cursed_halls",
    groups:["large"],
    entity: "dungeons:wraith",
    weight:10
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "dungeons:necromancer",
    weight:10
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "minecraft:husk",
    weight:10
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "minecraft:spider",
    weight:12
  },
  {
    type:"cursed_halls",
    groups:["small", "large"],
    entity: "minecraft:cave_spider",
    weight:6
  },
  {
    type:"cursed_halls",
    groups:["large"],
    entity: "minecraft:creeper",
    weight:10
  },
  {
    type:"cursed_halls",
    groups:["large"],
    entity: "dungeons:redstone_golem",
    weight:1
  },
  {
    type: "cursed",
    groups: ["large"],
    entity: "minecraft:skeleton_horse",
    weight: 0.15,
    always_spawn: false,
    event: "minecraft:set_trap",
  },
  //coral cave
  {
    type:"coral_cave",
    groups:["small","large"],
    entity: "minecraft:zombie",
    weight:15,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["small","large"],
    entity: "minecraft:skeleton",
    weight:15,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["small","large"],
    entity: "minecraft:drowned",
    weight:20
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "minecraft:sunken_skeleton",
    weight:10
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "dungeons:jungle_zombie",
    weight:10,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "minecraft:creeper",
    weight:8,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["small", "large"],
    entity: "minecraft:spider",
    weight:8,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "minecraft:cave_spider",
    weight:8,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "minecraft:slime",
    weight:8,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "dungeons:necromancer",
    weight:8,
    excludeWater:true
  },
  {
    type:"coral_cave",
    groups:["small", "large"],
    entity: "dungeons:wavewhisperer",
    weight:5,
    requireWater:true
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "dungeons:drowned_necromancer",
    weight:1
  },
  {
    type:"coral_cave",
    groups:["large"],
    entity: "dungeons:poison_anemone",
    weight:7
  },
  {
    type:"coral_cave",
    groups:["small","large"],
    entity: "dungeons:tropical_slime",
    weight:7
  },
  //frosted_fjord
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "dungeons:frozen_zombie",
    weight:20,
    headgear: "dungeons:guard_helmet"
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "dungeons:frozen_zombie",
    weight:5,
    headgear: "dungeons:scale_mail_helmet"
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "minecraft:stray",
    weight:12,
    headgear: "dungeons:guard_helmet"
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "minecraft:stray",
    weight:3,
    headgear: "dungeons:scale_mail_helmet"
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "dungeons:icy_creeper",
    weight:9
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "minecraft:spider",
    weight:14
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:vanguard",
    weight:8
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:tower_wraith",
    weight:4
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:geomancer",
    weight:8
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:iceologer",
    weight:10
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "minecraft:pillager",
    weight:8
  },
  {
    type:"frosted_fjord",
    groups:["small","large"],
    entity: "dungeons:mountaineer",
    weight:10
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:illusioner",
    weight:1
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:redstone_golem",
    weight:1
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "minecraft:evoker",
    weight:1
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:enchanted_pillager",
    weight:2
  },
  {
    type:"frosted_fjord",
    groups:["large"],
    entity: "dungeons:enchanted_mountaineer",
    weight:2
  },

  //outer end
  {
    type:"outer_end",
    groups:["small", "large"],
    entity: "minecraft:pillager",
    weight:10
  },
  {
    type:"outer_end",
    groups:[ "large"],
    entity: "minecraft:vindicator",
    weight:3
  },
  {
    type:"outer_end",
    groups:["small"],
    entity: "minecraft:enderman",
    weight:10
  },
  {
    type:"outer_end",
    groups:["small", "large"],
    entity: "dungeons:watchling",
    weight:22
  },
  {
    type:"outer_end",
    groups:["small", "large"],
    entity: "minecraft:endermite",
    weight:16
  },
  {
    type:"outer_end",
    groups:["large"],
    entity: "dungeons:blastling",
    weight:10
  },
  {
    type:"outer_end",
    groups:["large"],
    entity: "dungeons:snareling",
    weight:10
  },
  {
    type:"outer_end",
    groups:["large"],
    entity: "dungeons:endersent",
    weight:2
  },
  {
    type:"outer_end",
    groups:["large", "small"],
    entity: "dungeons:enchanted_endermite",
    weight:1
  },
  //soul_ruins
  {
    type:"soul_ruins",
    groups:["small", "large"],
    entity: "minecraft:zombie",
    weight:22
  },
  {
    type:"soul_ruins",
    groups:["small", "large"],
    entity: "minecraft:skeleton",
    weight:15
  },
  {
    type:"soul_ruins",
    groups:["small", "large"],
    entity: "minecraft:spider",
    weight:11
  },
  {
    type:"soul_ruins",
    groups:["large"],
    entity: "minecraft:creeper",
    weight:8
  },
  {
    type:"soul_ruins",
    groups:["small", "large"],
    entity: "dungeons:necromancer",
    weight:6
  },
  {
    type:"soul_ruins",
    groups:["large"],
    entity: "dungeons:wraith",
    weight:5
  },
  {
    type:"soul_ruins",
    groups:["large"],
    entity: "dungeons:vanguard",
    weight:5
  },
  {
    type:"soul_ruins",
    groups:["large"],
    entity: "dungeons:tower_guard",
    weight:1
  },
  {
    type:"soul_ruins",
    groups:["large"],
    entity: "dungeons:illusioner",
    weight:0.5
  },
  {
    type: "soul_ruins",
    groups: ["large"],
    entity: "minecraft:skeleton_horse",
    weight: 0.15,
    always_spawn: false,
    event: "minecraft:set_trap",
  }

];
