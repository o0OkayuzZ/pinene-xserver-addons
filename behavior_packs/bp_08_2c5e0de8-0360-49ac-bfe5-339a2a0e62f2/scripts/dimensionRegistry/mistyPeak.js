import { world, system, EntityDamageCause } from "@minecraft/server";
import {hunts} from "./main.js"

const DIM_ID = "dungeons:ancientdim_misty_peak";

//generate barrier
system.runInterval(() => {
  if (!hunts) return;
  const dim = world.getDimension(DIM_ID);
  for (const player of dim.getPlayers({ excludeGameModes: ["Spectator"] })) {
    if (!player.isOnGround && !player.isJumping) continue;
    if (player.hasTag("dungeons:portal_proof")) continue;
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
  "minecraft:podzol",
];

const canBarrierPast = [
  "minecraft:snow_layer",
  "minecraft:air",
  "minecraft:spruce_leaves",
  "minecraft:red_poplar_leaves",
  "minecraft:orange_poplar_leaves",
  "minecraft:yellow_poplar_leaves",
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
        y: 75,
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
        for (let k = 60; k < 100; k++) {
          const newLoc = { x: loc.x, y: k, z: loc.z };
          const nBlock = dim.getBlock(newLoc);
          if (nBlock && canBarrier.includes(nBlock.typeId))
            nBlock.setType("dungeons:ancient_hunt_barrier");
        }
      }
    }
  }
}

const outofbounds = 76
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
}, 5)

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


world.afterEvents.entitySpawn.subscribe((e) => {
  const entity = e.entity;
  const cause = e.cause;
  if (!entity.isValid) return;
  if (entity.dimension.id !== DIM_ID) return;
  if (!entity.matches({ families: ["mob"] })) return;
  if (entity.y < 50) return;
  if (cause == "Spawned") {
    attemptBarriers(entity, entity.dimension);
  }
});

system.runInterval(() => {
  for (const player of world.getDimension(DIM_ID).getPlayers()) {
    if (!player.getDynamicProperty("dungeons:ambient_effects")) continue;
    if (player.dimension.isChunkLoaded(player.location))
      player.spawnParticle("dungeons:misty_peak_clouds", {
        x: player.location.x,
        y: 70,
        z: player.location.z,
      });
    if (player.dimension.isChunkLoaded(player.location))
      player.spawnParticle("dungeons:misty_peak_clouds_thin", {
        x: player.location.x,
        y: 90,
        z: player.location.z,
      });
  }
}, 10);
