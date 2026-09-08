import { StructureSaveMode, system, world } from "@minecraft/server";
import { IDS, NATURAL_ISLAND_IMPORT, STATE_KEYS } from "./config.js";

const WATER_BLOCKS = new Set([
  "minecraft:water",
  "minecraft:flowing_water",
  "minecraft:kelp",
  "minecraft:seagrass",
  "minecraft:tall_seagrass",
]);

const AIR_BLOCKS = new Set([
  "minecraft:air",
  "minecraft:cave_air",
  "minecraft:void_air",
]);

let importRunning = false;

function waitTicks(ticks) {
  return new Promise((resolve) => system.runTimeout(resolve, ticks));
}

function candidateCenter(index) {
  const ring = Math.floor(index / 8) + 1;
  const side = index % 8;
  const offsets = [
    [1, 0], [1, 1], [0, 1], [-1, 1],
    [-1, 0], [-1, -1], [0, -1], [1, -1],
  ];
  const [dx, dz] = offsets[side];
  const distance = NATURAL_ISLAND_IMPORT.searchStart + ring * NATURAL_ISLAND_IMPORT.searchSpacing;
  return {
    x: Math.floor((dx * distance) / 16) * 16,
    z: Math.floor((dz * distance) / 16) * 16,
  };
}

function columnKind(dimension, x, z) {
  for (let y = NATURAL_ISLAND_IMPORT.yMax; y >= 63; y -= 1) {
    const typeId = dimension.getBlock({ x, y, z })?.typeId;
    if (!typeId || AIR_BLOCKS.has(typeId)) continue;
    return WATER_BLOCKS.has(typeId) ? "water" : "land";
  }
  const seaBlock = dimension.getBlock({ x, y: 62, z })?.typeId;
  return seaBlock && WATER_BLOCKS.has(seaBlock) ? "water" : "void";
}

function evaluateCandidate(dimension, center) {
  const half = NATURAL_ISLAND_IMPORT.searchSize / 2;
  let centerLand = 0;
  let centerSamples = 0;
  let edgeWater = 0;
  let edgeSamples = 0;

  for (let ox = -half; ox < half; ox += NATURAL_ISLAND_IMPORT.sampleStep) {
    for (let oz = -half; oz < half; oz += NATURAL_ISLAND_IMPORT.sampleStep) {
      const edge = Math.abs(ox) >= half - NATURAL_ISLAND_IMPORT.sampleStep
        || Math.abs(oz) >= half - NATURAL_ISLAND_IMPORT.sampleStep;
      const kind = columnKind(dimension, center.x + ox, center.z + oz);
      if (edge) {
        edgeSamples += 1;
        if (kind === "water") edgeWater += 1;
      } else if (Math.abs(ox) <= 16 && Math.abs(oz) <= 16) {
        centerSamples += 1;
        if (kind === "land") centerLand += 1;
      }
    }
  }

  return {
    centerLandRatio: centerSamples === 0 ? 0 : centerLand / centerSamples,
    edgeWaterRatio: edgeSamples === 0 ? 0 : edgeWater / edgeSamples,
  };
}

function isIslandCandidate(score) {
  return score.centerLandRatio >= 0.35 && score.edgeWaterRatio >= 0.6;
}

async function loadCandidate(dimension, center) {
  const manager = world.tickingAreaManager;
  if (manager.hasTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId)) {
    manager.removeTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId);
  }
  const half = NATURAL_ISLAND_IMPORT.searchSize / 2;
  await manager.createTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId, {
    dimension,
    from: { x: center.x - half, y: NATURAL_ISLAND_IMPORT.yMin, z: center.z - half },
    to: { x: center.x + half - 1, y: NATURAL_ISLAND_IMPORT.yMax, z: center.z + half - 1 },
  });
  await waitTicks(20);
}

async function copyCandidateToPinene(sourceDimension, center, player) {
  const targetDimension = world.getDimension(IDS.dimension);
  const manager = world.structureManager;
  const tickingAreas = world.tickingAreaManager;
  const half = NATURAL_ISLAND_IMPORT.importSize / 2;
  let placed = 0;
  const verticalLayers = (NATURAL_ISLAND_IMPORT.yMax - NATURAL_ISLAND_IMPORT.yMin + 1)
    / NATURAL_ISLAND_IMPORT.verticalTileSize;
  const totalTiles = (NATURAL_ISLAND_IMPORT.importSize / 16) ** 2 * verticalLayers;

  for (let batchX = 0; batchX < NATURAL_ISLAND_IMPORT.importSize; batchX += NATURAL_ISLAND_IMPORT.batchSize) {
    for (let batchZ = 0; batchZ < NATURAL_ISLAND_IMPORT.importSize; batchZ += NATURAL_ISLAND_IMPORT.batchSize) {
      if (tickingAreas.hasTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId)) {
        tickingAreas.removeTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId);
      }
      if (tickingAreas.hasTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId)) {
        tickingAreas.removeTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId);
      }

      await tickingAreas.createTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId, {
        dimension: sourceDimension,
        from: { x: center.x - half + batchX, y: NATURAL_ISLAND_IMPORT.yMin, z: center.z - half + batchZ },
        to: {
          x: center.x - half + batchX + NATURAL_ISLAND_IMPORT.batchSize - 1,
          y: NATURAL_ISLAND_IMPORT.yMax,
          z: center.z - half + batchZ + NATURAL_ISLAND_IMPORT.batchSize - 1,
        },
      });
      await tickingAreas.createTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId, {
        dimension: targetDimension,
        from: { x: -half + batchX, y: NATURAL_ISLAND_IMPORT.yMin, z: -half + batchZ },
        to: {
          x: -half + batchX + NATURAL_ISLAND_IMPORT.batchSize - 1,
          y: NATURAL_ISLAND_IMPORT.yMax,
          z: -half + batchZ + NATURAL_ISLAND_IMPORT.batchSize - 1,
        },
      });
      await waitTicks(10);

      for (let layerY = NATURAL_ISLAND_IMPORT.yMin; layerY <= NATURAL_ISLAND_IMPORT.yMax; layerY += NATURAL_ISLAND_IMPORT.verticalTileSize) {
        const layerTop = layerY + NATURAL_ISLAND_IMPORT.verticalTileSize - 1;
        for (let localX = 0; localX < NATURAL_ISLAND_IMPORT.batchSize; localX += 16) {
          for (let localZ = 0; localZ < NATURAL_ISLAND_IMPORT.batchSize; localZ += 16) {
            const tileX = batchX + localX;
            const tileZ = batchZ + localZ;
            const id = `${NATURAL_ISLAND_IMPORT.snapshotPrefix}x${tileX}_z${tileZ}_y${layerY}`;
            const existing = manager.get(id);
            if (existing) manager.delete(existing);
            manager.createFromWorld(id, sourceDimension, {
              x: center.x - half + tileX,
              y: layerY,
              z: center.z - half + tileZ,
            }, {
              x: center.x - half + tileX + 15,
              y: layerTop,
              z: center.z - half + tileZ + 15,
            }, {
              includeBlocks: true,
              includeEntities: false,
              saveMode: StructureSaveMode.World,
            });
            manager.place(id, targetDimension, {
              x: -half + tileX,
              y: layerY,
              z: -half + tileZ,
            });
            placed += 1;
          }
        }
      }
      if (placed % 768 === 0 && player.isValid) {
        player.sendMessage(`§7自然島を転送中: ${placed}/${totalTiles}タイル`);
      }
      await waitTicks(1);
    }
  }
  return placed;
}

async function findAndImportIsland(player, message) {
  if (importRunning) {
    player.sendMessage("§e自然島の検索はすでに実行中です。完了まで待ってください。");
    return;
  }
  importRunning = true;
  const requested = Number.parseInt(message.trim(), 10);
  const attempts = Number.isInteger(requested)
    ? Math.max(1, Math.min(requested, NATURAL_ISLAND_IMPORT.maxAttempts))
    : NATURAL_ISLAND_IMPORT.defaultAttempts;
  const overworld = world.getDimension("minecraft:overworld");
  let searchIndex = world.getDynamicProperty(STATE_KEYS.naturalIslandSearchIndex);
  if (!Number.isInteger(searchIndex) || searchIndex < 0) searchIndex = 0;

  player.sendMessage(`§e自然島を検索します。最大${attempts}地点を調査します…`);
  try {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const index = searchIndex + attempt;
      const center = candidateCenter(index);
      await loadCandidate(overworld, center);
      const score = evaluateCandidate(overworld, center);
      if ((attempt + 1) % 4 === 0) {
        player.sendMessage(`§7検索中 ${attempt + 1}/${attempts}…`);
      }
      if (!isIslandCandidate(score)) continue;

      player.sendMessage(`§a自然島を発見しました。512×512の転送を開始します。`);
      const placed = await copyCandidateToPinene(overworld, center, player);
      world.setDynamicProperty(STATE_KEYS.naturalIslandSearchIndex, index + 1);
      player.sendMessage(`§a自然島を発見し、ピネディメンションへ配置しました。元座標: ${center.x}, ${center.z}`);
      player.sendMessage(`§7中央陸地率=${Math.round(score.centerLandRatio * 100)}%、外周海率=${Math.round(score.edgeWaterRatio * 100)}%、タイル=${placed}`);
      player.sendMessage("§e確認: /scriptevent pinene_pvp:enter　別候補: /scriptevent pinene_pvp:find_island");
      return;
    }
    world.setDynamicProperty(STATE_KEYS.naturalIslandSearchIndex, searchIndex + attempts);
    player.sendMessage("§e今回の範囲では島を発見できませんでした。同じコマンドでもう一度検索できます。");
  } finally {
    const manager = world.tickingAreaManager;
    if (manager.hasTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId)) {
      manager.removeTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId);
    }
    if (manager.hasTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId)) {
      manager.removeTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId);
    }
    importRunning = false;
  }
}

async function importIslandAtPlayer(player) {
  if (importRunning) {
    player.sendMessage("§e自然島の検索または転送はすでに実行中です。完了まで待ってください。");
    return;
  }
  if (player.dimension.id !== "minecraft:overworld") {
    player.sendMessage("§c採取したいオーバーワールドの地点で実行してください。");
    return;
  }

  importRunning = true;
  const center = {
    x: Math.floor(player.location.x / 16) * 16 + 8,
    z: Math.floor(player.location.z / 16) * 16 + 8,
  };
  player.sendMessage(`§e現在地付近を中心に512×512の転送を開始します。中心: ${center.x}, ${center.z}`);
  try {
    const placed = await copyCandidateToPinene(player.dimension, center, player);
    player.sendMessage(`§a採取地点をピネディメンションへ転送しました。中心: ${center.x}, ${center.z}、タイル: ${placed}`);
    player.sendMessage("§e確認: /scriptevent pinene_pvp:enter");
  } finally {
    const manager = world.tickingAreaManager;
    if (manager.hasTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId)) {
      manager.removeTickingArea(NATURAL_ISLAND_IMPORT.tickingAreaId);
    }
    if (manager.hasTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId)) {
      manager.removeTickingArea(NATURAL_ISLAND_IMPORT.targetTickingAreaId);
    }
    importRunning = false;
  }
}

system.afterEvents.scriptEventReceive.subscribe((event) => {
  if (event.id !== "pinene_pvp:find_island" && event.id !== "pinene_pvp:import_island_here") return;
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player") return;
  const operation = event.id === "pinene_pvp:import_island_here"
    ? importIslandAtPlayer(player)
    : findAndImportIsland(player, event.message);
  void operation.catch((error) => {
    console.error(`[pinene_pvp] Natural island import failed: ${error}`);
    player.sendMessage("§c自然島の検索または配置に失敗しました。コンテンツログを確認してください。");
  });
});
