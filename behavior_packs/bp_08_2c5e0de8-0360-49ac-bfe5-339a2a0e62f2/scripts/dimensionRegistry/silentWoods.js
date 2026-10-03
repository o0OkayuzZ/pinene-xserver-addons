import { world, system } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_silent_woods";

//generate barrier
system.runInterval(() => {
  if (!hunts) return;
  const dim = world.getDimension(DIM_ID);
  for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
    if (!player.isOnGround && !player.isJumping) continue;
    if (player.hasTag("dungeons:portal_proof")) continue;
    if (player.hasTag("dungeons:ancient_hunt_loading")) continue;
    for (let i = -30; i < 30; i++) {
      system.runTimeout(
        () => {
          for (let j = -32; j < 32; j++) {
            const loc = {
              x: player.location.x + i,
              y: 59,
              z: player.location.z + j,
            };
            const block = dim.getBlock(loc);
            if (!block) continue;
            const above = dim.getBlock(loc).above();
            if (!above) continue;
            if (
              block.isAir ||
              (block.typeId == "dungeons:ancient_hunt_barrier" &&
                (above.isAir ||
                  above.typeId == "dungeons:ancient_hunt_barrier"))
            ) {
              block.setType("grass");
              if (Math.random() > 0.68 && above.isAir) {
                above.setType("short_grass");
              } else if (Math.random() > 0.98 && above.isAir) {
                above.setType("bush");
              } else if (Math.random() > 0.995 && above.isAir) {
                above.setType("firefly_bush");
              } else if (
                Math.random() > 0.993 &&
                above.isAir &&
                above.above().isAir
              ) {
                system.runTimeout(() => {
                  dim.placeFeature(
                    "minecraft:spruce_tree_feature",
                    { x: above.x, y: 60, z: above.z },
                    false,
                  );
                }, 1);
              } else if (
                Math.random() > 0.993 &&
                above.isAir &&
                above.above().isAir
              ) {
                system.runTimeout(() => {
                  var id = "minecraft:oak_tree_feature"
                  if(Math.random() > 0.5) id = "minecraft:spruce_tree_feature"
                  dim.placeFeature(
                    id,
                    { x: above.x, y: 60, z: above.z },
                    false,
                  );
                }, 1);
              }
            }
          }
        },
        Math.floor((i + 32) / 3),
      );
    }
    attemptBarriers(player, dim);
  }
}, 5);

const canBarrier = ["minecraft:air"];

const canNeigbour = [
  "minecraft:dirt",
  "minecraft:dirt_with_roots",
  "minecraft:stone",
  "minecraft:grass",
  "minecraft:coarse_dirt",
  "minecraft:podzol"
]

const canBarrierPast = [
  "minecraft:short_grass",
  "minecraft:air",
  "minecraft:spruce_leaves",
  "minecraft:bush",
  "minecraft:firefely_bush"
];

function attemptBarriers(entity, dim) {
  if (!entity.isValid) return;
  if (entity.typeId == "minecraft:player" && entity.hasTag("dungeons:ancient_hunt_loading")) return;
  const originX = entity.location.x;
  const originZ = entity.location.z;
  var range = 10
  if(entity.typeId !== "minecraft:player") range = 5
  for (let i = -range; i < range; i++) {
    for (let j = -range; j < range; j++) {
      const loc = {
        x: originX + i,
        y: 60,
        z: originZ + j,
      };
      const block = dim.getBlock(loc);
      if (!block) continue;
      if (canBarrierPast.includes(block.typeId) == false) continue;
      const neighbours = [
        block.east(),
        block.west(),
        block.north(),
        block.south(),
      ];
      var makePillar = false;
      for(const neigh of neighbours) {
        if(!neigh) return;
        if(canNeigbour.includes(neigh.typeId)) makePillar = true
      }
      if (makePillar) {
        for (let k = 60; k < 80; k++) {
          const newLoc = { x: loc.x, y: k, z: loc.z };
          const nBlock = dim.getBlock(newLoc);
          if (nBlock && canBarrier.includes(nBlock.typeId))
            nBlock.setType("dungeons:ancient_hunt_barrier");
        }
      }
    }
  }
}


const outofbounds = 62
system.runInterval(() => {
    if (!hunts) return;
    const dim = world.getDimension(DIM_ID)
    for(const entity of dim.getEntities({tags:["dungeons:hunt_spawnpoint"]})) {
        if(entity.location.y < outofbounds) {
          attemptBarriers(entity, dim)
          entity.addEffect("invisibility", 2)
          const targetLoc = entity.getDynamicProperty("dungeons:hunt_spawnpoint")
          entity.teleport(targetLoc)
          if(dim.isChunkLoaded(targetLoc)) {
            dim.spawnParticle("dungeons:instant_teleport", {x:targetLoc.x, y:targetLoc.y+1, z:targetLoc.z})
            dim.playSound("mob.endermen.portal", targetLoc, { pitch: 0.65 })
          }
        }
    }
})

world.afterEvents.entitySpawn.subscribe((e) => {
    if (!hunts) return;
  const entity = e.entity
  if(!entity.isValid) return;
  const dim = entity.dimension;
  if(dim.id !== DIM_ID) return;
  const loc = entity.location
  if(loc.y < outofbounds) return;
  system.runTimeout(() => {
    if(!entity.isValid)  return;
    if(entity.hasTag("dungeons:ancient_hunt")) {
      entity.setDynamicProperty("dungeons:hunt_spawnpoint", {x:loc.x,y:Math.max(loc.y,outofbounds),z:loc.z})
      entity.addTag("dungeons:hunt_spawnpoint")
    }
  }, 3)
})