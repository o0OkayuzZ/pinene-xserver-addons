import { BlockPermutation, world } from "@minecraft/server";
import { IDS, POC } from "./config.js";

let bootstrapPromise;

function placePocPlatform(dimension) {
  const floor = BlockPermutation.resolve("minecraft:obsidian");
  const core = BlockPermutation.resolve(IDS.islandCore);
  for (let x = -POC.platformRadius; x <= POC.platformRadius; x += 1) {
    for (let z = -POC.platformRadius; z <= POC.platformRadius; z += 1) {
      dimension.getBlock({ x, y: POC.center.y - 1, z })?.setPermutation(floor);
    }
  }
  dimension.getBlock(POC.center)?.setPermutation(core);
}

async function buildPocPlatform() {
  const dimension = world.getDimension(IDS.dimension);
  const manager = world.tickingAreaManager;
  const margin = 2;

  if (manager.hasTickingArea(POC.tickingAreaId)) {
    manager.removeTickingArea(POC.tickingAreaId);
  }

  await manager.createTickingArea(POC.tickingAreaId, {
    dimension,
    from: {
      x: POC.center.x - POC.platformRadius - margin,
      y: POC.center.y - 2,
      z: POC.center.z - POC.platformRadius - margin,
    },
    to: {
      x: POC.center.x + POC.platformRadius + margin,
      y: POC.center.y + 3,
      z: POC.center.z + POC.platformRadius + margin,
    },
  });

  try {
    placePocPlatform(dimension);
  } finally {
    if (manager.hasTickingArea(POC.tickingAreaId)) {
      manager.removeTickingArea(POC.tickingAreaId);
    }
  }
}

export function ensurePocPlatform() {
  if (!bootstrapPromise) {
    bootstrapPromise = buildPocPlatform().catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  }
  return bootstrapPromise;
}

export function rebuildPocPlatform() {
  const previousBuild = bootstrapPromise;
  bootstrapPromise = (previousBuild ? previousBuild.catch(() => undefined) : Promise.resolve())
    .then(() => buildPocPlatform())
    .catch((error) => {
      bootstrapPromise = undefined;
      throw error;
    });
  return bootstrapPromise;
}

world.afterEvents.worldLoad.subscribe(() => {
  void ensurePocPlatform().catch((error) => {
    console.error(`[pinene_pvp] Failed to bootstrap PvP island: ${error}`);
  });
});
