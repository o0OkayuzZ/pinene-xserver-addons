import { world } from "@minecraft/server";
import { IDS, STATE_KEYS } from "./config.js";
import { isPvpIsland } from "./ability_gate.js";
import { readJsonResult, writeJson } from "./state_store.js";

function emptyRegistry() {
  return { schemaVersion: 1, entries: [] };
}

export function readMarkerRegistry() {
  const result = readJsonResult(STATE_KEYS.markers, emptyRegistry);
  if (!result.ok) return result;
  const registry = result.value;
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.entries)) {
    return { ok: false, exists: result.exists, reason: "invalid_marker_registry_schema" };
  }
  for (const marker of registry.entries) {
    const location = marker?.location;
    const valid = typeof marker?.key === "string"
      && typeof marker?.ownerId === "string"
      && marker?.dimensionId === IDS.dimension
      && Number.isInteger(location?.x)
      && Number.isInteger(location?.y)
      && Number.isInteger(location?.z)
      && Number.isInteger(marker?.chunkX)
      && Number.isInteger(marker?.chunkZ)
      && marker.chunkX === chunkCoordinate(location.x)
      && marker.chunkZ === chunkCoordinate(location.z)
      && marker.key === markerKey(marker.dimensionId, location);
    if (!valid) {
      return { ok: false, exists: result.exists, reason: "invalid_marker_registry_entry" };
    }
  }
  return result;
}

function chunkCoordinate(value) {
  return Math.floor(value / 16);
}

function markerKey(dimensionId, location) {
  return `${dimensionId}:${location.x},${location.y},${location.z}`;
}

function addMarker(player, block) {
  if (!isPvpIsland(block)) {
    player.sendMessage("§c仮拠点マーカーは無人島でのみ機能します。");
    return;
  }

  const result = readMarkerRegistry();
  if (!result.ok) {
    player.sendMessage("§cマーカー台帳が壊れているため登録を中止しました。管理者に連絡してください。");
    return;
  }
  const registry = result.value;
  const key = markerKey(block.dimension.id, block.location);
  if (registry.entries.some((marker) => marker.key === key)) return;

  registry.entries.push({
    key,
    ownerId: player.id,
    dimensionId: block.dimension.id,
    location: block.location,
    chunkX: chunkCoordinate(block.location.x),
    chunkZ: chunkCoordinate(block.location.z),
  });
  writeJson(STATE_KEYS.markers, registry);
  player.sendMessage(`§aチャンク (${chunkCoordinate(block.location.x)}, ${chunkCoordinate(block.location.z)}) を自動復元の除外候補として登録しました。`);
}

function removeMarker(block, brokenBlockPermutation) {
  if (brokenBlockPermutation.type.id !== IDS.markerBlock) return;
  const key = markerKey(block.dimension.id, block.location);
  const result = readMarkerRegistry();
  if (!result.ok) {
    console.error(`[pinene_pvp] Marker registry is unreadable; refusing removal: ${result.reason}`);
    return;
  }
  result.value.entries = result.value.entries.filter((marker) => marker.key !== key);
  writeJson(STATE_KEYS.markers, result.value);
}

world.afterEvents.playerPlaceBlock.subscribe(({ player, block }) => {
  if (block.typeId === IDS.markerBlock) addMarker(player, block);
});

world.afterEvents.playerBreakBlock.subscribe(({ block, brokenBlockPermutation }) => {
  removeMarker(block, brokenBlockPermutation);
});

world.afterEvents.blockExplode.subscribe(({ block, explodedBlockPermutation }) => {
  removeMarker(block, explodedBlockPermutation);
});

export function excludedChunkKeys() {
  const result = readMarkerRegistry();
  if (!result.ok) {
    throw new Error(`Unsafe marker registry: ${result.reason}`);
  }
  return new Set(result.value.entries.map((marker) => `${marker.chunkX},${marker.chunkZ}`));
}
