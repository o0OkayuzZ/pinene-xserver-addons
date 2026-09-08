import { world } from "@minecraft/server";
import { IDS, ISLAND_TEMPLATE, STATE_KEYS } from "./config.js";
import { ensurePocPlatform } from "./island_bootstrap.js";

const TILE_PATTERN = /^pinene_pvp:island\/c_([np]\d+)_([np]\d+)_y_([np]\d+)_([np]\d+)$/;

function decodeInteger(value) {
  const magnitude = Number.parseInt(value.slice(1), 10);
  if (!Number.isSafeInteger(magnitude)) throw new Error(`Invalid encoded integer: ${value}`);
  return value[0] === "n" ? -magnitude : magnitude;
}

export function parsePackTileId(id) {
  const match = TILE_PATTERN.exec(id);
  if (!match) return undefined;
  const chunkX = decodeInteger(match[1]);
  const chunkZ = decodeInteger(match[2]);
  const yMin = decodeInteger(match[3]);
  const yMax = decodeInteger(match[4]);
  if (yMax < yMin || yMax - yMin + 1 > ISLAND_TEMPLATE.maxTileHeight) {
    throw new Error(`Invalid tile height in ${id}`);
  }
  return { id, chunkX, chunkZ, yMin, yMax };
}

export function getPackIslandTiles() {
  return world.structureManager.getPackStructureIds()
    .filter((id) => id.startsWith(ISLAND_TEMPLATE.prefix))
    .map((id) => {
      const tile = parsePackTileId(id);
      if (!tile) throw new Error(`Invalid island tile name: ${id}`);
      return tile;
    })
    .sort((a, b) => a.yMin - b.yMin || a.chunkX - b.chunkX || a.chunkZ - b.chunkZ);
}

export async function applyPackIslandTemplate(force = false) {
  const appliedRevision = world.getDynamicProperty(STATE_KEYS.templateRevision);
  if (!force && appliedRevision === ISLAND_TEMPLATE.revision) {
    return { placed: 0, skipped: true };
  }

  const tiles = getPackIslandTiles();
  if (tiles.length === 0) return { placed: 0, skipped: false };

  await ensurePocPlatform();
  const dimension = world.getDimension(IDS.dimension);
  for (const tile of tiles) {
    world.structureManager.place(tile.id, dimension, {
      x: tile.chunkX * 16,
      y: tile.yMin,
      z: tile.chunkZ * 16,
    });
  }
  world.setDynamicProperty(STATE_KEYS.templateRevision, ISLAND_TEMPLATE.revision);
  return { placed: tiles.length, skipped: false };
}

world.afterEvents.worldLoad.subscribe(() => {
  void applyPackIslandTemplate(false).catch((error) => {
    console.error(`[pinene_pvp] Failed to apply island pack template: ${error}`);
  });
});
