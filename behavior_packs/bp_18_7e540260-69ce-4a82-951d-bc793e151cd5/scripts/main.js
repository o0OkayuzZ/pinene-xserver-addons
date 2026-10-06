import { GameMode, ItemStack, system, world } from "@minecraft/server";
import { PLACEABLE_FOODS } from "./meshy_food_catalog.js";

const PICKUP_ITEMS = Object.freeze({
  ...Object.fromEntries(Object.entries(PLACEABLE_FOODS).map(([item, entity]) => [entity, item])),
  // Retain retrieval of the two earlier Pine Food display entities.
  "pine:honey_bread_placed": "pine:honey_bread",
  "pine:apple_bread_placed": "pine:apple_bread",
});
const placementQueues = new Map();
const collecting = new Set();
const MAX_QUEUED_PLACEMENTS = 16;

function tell(player, text) {
  try { player.sendMessage("§e[Pine Food] " + text); } catch (_) { /* Player left. */ }
}

function placeQueuedFood(request) {
  const { player, itemId, entityId, slot, dimension, blockLocation, blockType, face, surface, yaw } = request;
  let spawned;
  try {
    if (face !== "up") {
      tell(player, "ブロックの上面を狙って、Shift＋使用で置けます。");
      return;
    }
    const mode = player.getGameMode();
    if (mode !== GameMode.Creative && mode !== GameMode.Survival) return;
    if (player.dimension.id !== dimension.id || player.selectedSlotIndex !== slot) return;
    const inventory = player.getComponent("minecraft:inventory")?.container;
    const held = inventory?.getItem(slot);
    if (!held || held.typeId !== itemId || held.amount < 1) return;
    const support = dimension.getBlock(blockLocation);
    if (!support || support.typeId !== blockType || support.isAir || support.isLiquid) return;
    if (!Number.isFinite(surface) || surface < 0 || surface > 1.001) return;
    const location = { x: blockLocation.x + 0.5, y: blockLocation.y + surface + 0.002, z: blockLocation.z + 0.5 };
    const head = player.getHeadLocation();
    if ((head.x-location.x)**2 + (head.y-location.y)**2 + (head.z-location.z)**2 > 49) return;
    // Above slabs, keep the original hit height. Never replace the support block.
    for (const height of [0.02, 0.99]) {
      const point = { x: location.x, y: location.y + height, z: location.z };
      if (Math.floor(point.y) === blockLocation.y) continue;
      const space = dimension.getBlock(point);
      if (!space?.isAir) { tell(player, "料理を置く上の空間を空けてください。"); return; }
    }
    if (dimension.getEntities({ families: ["pine_meshy_food_display"], location, maxDistance: 0.35 }).length) {
      tell(player, "ここには料理が置かれています。別の場所に置いてください。");
      return;
    }
    spawned = dimension.spawnEntity(entityId, location);
    spawned.setRotation({ x: 0, y: yaw });
    if (mode !== GameMode.Creative) {
      if (held.amount > 1) { held.amount -= 1; inventory.setItem(slot, held); }
      else inventory.setItem(slot, undefined);
    }
    spawned = undefined; // Placement and inventory update both completed.
  } catch (error) {
    if (spawned) { try { spawned.remove(); } catch (_) { /* Already removed. */ } }
    console.warn("[PineFood3D] placement failed: " + String(error));
    tell(player, "設置できませんでした。ワールドを再読み込みして試してください。");
  }
}

function drainPlacementQueue(playerId) {
  const queue = placementQueues.get(playerId);
  if (!queue?.length) {
    placementQueues.delete(playerId);
    return;
  }
  placeQueuedFood(queue.shift());
  if (queue.length) system.run(() => drainPlacementQueue(playerId));
  else placementQueues.delete(playerId);
}

// Food use can fail at full hunger; block interaction also works for ingredients.
world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
  const player = ev.player;
  const itemId = ev.itemStack?.typeId;
  const entityId = PLACEABLE_FOODS[itemId];
  if (ev.cancel || !entityId || !player.isSneaking) return;
  ev.cancel = true;
  // Bedrock can emit follow-up events while the input is held. Only enqueue the
  // first event of each interaction, but never discard a new first event merely
  // because the previous placement is still waiting for the next server tick.
  if (ev.isFirstEvent === false) return;

  const playerId = player.id;
  const hitHeight = ev.faceLocation.y;
  const request = {
    player,
    itemId,
    entityId,
    slot: player.selectedSlotIndex,
    dimension: ev.block.dimension,
    blockLocation: { ...ev.block.location },
    blockType: ev.block.typeId,
    face: String(ev.blockFace).toLowerCase(),
    surface: Number.isFinite(hitHeight) && Math.abs(hitHeight) < 0.0001 ? 1 : hitHeight,
    yaw: Math.round(player.getRotation().y / 45) * 45,
  };

  let queue = placementQueues.get(playerId);
  if (!queue) {
    queue = [];
    placementQueues.set(playerId, queue);
  }
  if (queue.length >= MAX_QUEUED_PLACEMENTS) {
    tell(player, "設置入力が速すぎます。少しだけ間隔を空けてください。");
    return;
  }
  const shouldStart = queue.length === 0;
  queue.push(request);
  if (shouldStart) system.run(() => drainPlacementQueue(playerId));
});

// Shift-use is reserved for placement; ordinary food use is left untouched.
world.beforeEvents.itemUse.subscribe((ev) => {
  if (ev.source?.isSneaking && PLACEABLE_FOODS[ev.itemStack?.typeId]) ev.cancel = true;
});

world.afterEvents.entityHitEntity.subscribe((ev) => {
  const player = ev.damagingEntity;
  const entity = ev.hitEntity;
  const itemId = PICKUP_ITEMS[entity?.typeId];
  if (player?.typeId !== "minecraft:player" || !itemId) return;
  const entityId = entity.id;
  if (collecting.has(entityId)) return;
  collecting.add(entityId);
  let drop;
  try {
    // Drop before removal; a failed spawn leaves the placed food intact.
    drop = entity.dimension.spawnItem(new ItemStack(itemId, 1), { ...entity.location });
    entity.remove();
  } catch (error) {
    if (drop) { try { drop.remove(); } catch (_) { /* Already removed. */ } }
    console.warn("[PineFood3D] pickup failed: " + String(error));
  } finally {
    system.run(() => collecting.delete(entityId));
  }
});

system.run(() => console.warn("[PineFood3D] Meshy placement ready: " + Object.keys(PLACEABLE_FOODS).length + " items; 2D held items; sneak + use on block top; 8 directions."));
