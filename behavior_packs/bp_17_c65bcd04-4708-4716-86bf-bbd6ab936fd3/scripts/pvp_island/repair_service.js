import { BlockPermutation, system, world } from "@minecraft/server";
import { AUTO_REPAIR as config, IDS } from "./config.js";
import { RepairStore, positionKey, shardKey } from "./repair_store.js";
import { AutoRepair } from "./auto_repair.js";
import { PlacementOwnership } from "./placement_ownership.js";
import { LostFound } from "./lost_found.js";
import { packItem, unpackItem, permutationData, samePermutation } from "./repair_items.js";

const store = new RepairStore(world, config);
const ownership = new PlacementOwnership(store);
const lostFound = new LostFound(store);
let ready = false, failed = false, worker, wakeQueued = false;
const removals = new Map();
const placementItems = new Map();
const gatewayKey = "pinene_pvp:repair_gateway_v1";
const dimension = () => world.getDimension(IDS.dimension);
const players = () => world.getAllPlayers().filter(p => p.dimension.id === IDS.dimension);
const managed = block => block.dimension.id === IDS.dimension;
const gateway = p => positionKey(p) === positionKey(config.gateway) && world.getDynamicProperty(gatewayKey) === true;
const protectedBlock = block => block.typeId === IDS.islandCore
  || block.typeId.startsWith("pinene_pvp:protected_") || gateway(block.location);
const repair = new AutoRepair(store, config, {
  restore(p, saved) {
    const block = dimension().getBlock(p);
    if (!block) return false;
    if (samePermutation(block, saved)) return true; // Interrupted completion is idempotent.
    if (!block.isAir) return false; // Never overwrite placed blocks, fluids or entities.
    block.setPermutation(BlockPermutation.resolve(saved.typeId, saved.states));
    if (saved.waterlogged) block.setWaterlogged(true);
    return true;
  },
});

function fail(error) {
  failed = true;
  console.error(`[pinene_pvp:repair] Paused to preserve saved state: ${error}`);
}
function guarded(fn) { try { return fn(); } catch (error) { fail(error); } }

world.afterEvents.worldLoad.subscribe(() => guarded(() => {
  if (config.regionSize < 4 || config.regionSize % 4 || config.nearbyRadius < 1
      || config.blocksPerTick < 1 || config.pollTicks < 1) throw Error("Invalid repair config");
  store.load(Date.now());
  ready = true;
}));

function captureContents(block) {
  const container = block.getComponent("minecraft:inventory")?.container;
  const contents = [];
  if (container) for (let i = 0; i < container.size; i++) {
    const item = packItem(container.getItem(i));
    if (item) contents.push(item);
  }
  return contents;
}

function clearWithoutDrops(block) {
  // setType uses replacement, never the native break/drop pipeline.
  const container = block.getComponent("minecraft:inventory")?.container;
  if (container) container.clearAll();
  block.setType("minecraft:air");
}

function removeOne(p, expected) {
  const block = dimension().getBlock(p);
  if (!block || !samePermutation(block, expected) || protectedBlock(block)) return;
  if (ownership.get(p)) {
    const group = [block];
    for (const otherPosition of ownership.get(p).companions ?? []) {
      const other = dimension().getBlock(otherPosition);
      if (!other) return; // Entire multi-block placement must be loaded.
      if (!other.isAir && ownership.get(otherPosition)) {
        if (other.typeId !== ownership.get(otherPosition).permutation.typeId) return;
        group.push(other);
      }
    }
    // Journal every half before removing any half. Native neighbor updates can
    // remove the second half; its return record must already exist at that point.
    let contents;
    try { contents = group.map(captureContents); }
    catch (error) {
      if (!String(error).includes("Unsupported return item data")) throw error;
      console.error(`[pinene_pvp:repair] Container left intact: ${error}`);
      return;
    }
    const refs = group.map((part, index) => ownership.beginReturn(
      { ...part.location }, contents[index], Date.now(), permutationData(part),
    ));
    for (const part of group) if (!part.isAir) clearWithoutDrops(part);
    for (const ref of refs) ownership.finishReturn(ref);
  } else {
    // BlockPermutation cannot preserve block-entity contents: leave them intact.
    if (block.getComponent("minecraft:inventory") || block.getComponent("minecraft:sign")) return;
    repair.record(p, expected, Date.now()); // Durable before any destructive write.
    clearWithoutDrops(block);
  }
}

function wake() {
  if (worker !== undefined || failed) return;
  worker = system.runInterval(() => guarded(() => {
    if (!ready || failed) return;
    let count = 0;
    for (const [key, request] of removals) {
      const cost = 1 + (ownership.get(request.position)?.companions?.length ?? 0);
      if (count + cost > config.removalBlocksPerTick) break;
      count += cost;
      // An unloaded block is retried by the next poll, not every tick forever.
      try { removeOne(request.position, request.permutation); }
      catch (error) {
        if (!String(error).includes("Unloaded")) throw error;
      }
      removals.delete(key);
    }
    if (repair.active.size) repair.tick(Date.now(), players());
    if (!removals.size && !repair.active.size) {
      system.clearRun(worker); worker = undefined;
    }
  }), 1);
}

function requestWake() {
  if (wakeQueued || worker !== undefined) return;
  wakeQueued = true;
  system.run(() => { wakeQueued = false; wake(); });
}

function queue(block, companions = true) {
  if (protectedBlock(block) || block.isAir) return;
  const position = { ...block.location }, key = positionKey(position);
  if (removals.has(key) || removals.size >= config.maxQueuedRemovals) return;
  removals.set(key, { position, permutation: permutationData(block) });
  if (companions) for (const p of ownership.get(position)?.companions ?? []) {
    const other = dimension().getBlock(p);
    if (other && !other.isAir) queue(other, false);
  }
}

world.beforeEvents.playerBreakBlock.subscribe(event => {
  if (!managed(event.block) || event.cancel) return;
  if (gateway(event.block.location)) { event.cancel = true; return; }
  if (protectedBlock(event.block)) return;
  event.cancel = true; // Native drops never occur, including when the service is paused.
  if (!ready || failed) return;
  queue(event.block);
  requestWake(); // One shared bounded worker; no block timers or runTimeout.
});

world.beforeEvents.explosion.subscribe(event => {
  if (event.dimension.id !== IDS.dimension) return;
  const blocks = event.getImpactedBlocks();
  event.setImpactedBlocks([]); // Preserve entity damage; suppress native block drops.
  if (!ready || failed) return;
  for (const block of blocks) queue(block);
  requestWake();
});

world.beforeEvents.playerInteractWithBlock.subscribe(event => {
  if (!managed(event.block)) return;
  if (!ready || failed) { event.cancel = true; return; }
  if (Object.values(store.get(event.block.location).returns).some(entry =>
    entry.status === "removing" && positionKey(entry.position) === positionKey(event.block.location))) {
    event.cancel = true;
    return;
  }
  if (gateway(event.block.location)) {
    event.cancel = true;
    if (!event.isFirstEvent) return;
    const player = event.player;
    system.run(() => guarded(() => claim(player)));
    return;
  }
  if (event.itemStack) {
    // getCanPlaceOn/getCanDestroy cannot run in a before-event callback.
    // Clone now; serialize in the writable after-event phase.
    placementItems.set(event.player.id, { tick: system.currentTick, stack: event.itemStack.clone() });
  }
});

function placementGroup(block) {
  const states = block.permutation.getAllStates(), p = block.location;
  let offsets = [];
  if ("upper_block_bit" in states) offsets = [{ x: 0, y: states.upper_block_bit ? -1 : 1, z: 0 }];
  if ("head_piece_bit" in states) {
    const direction = [{ x: 0, y: 0, z: 1 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 0 }][states.direction];
    if (direction) offsets = [{ x: direction.x * (states.head_piece_bit ? -1 : 1), y: 0, z: direction.z * (states.head_piece_bit ? -1 : 1) }];
  }
  const result = [block];
  for (const offset of offsets) {
    const other = dimension().getBlock({ x: p.x + offset.x, y: p.y + offset.y, z: p.z + offset.z });
    if (!other || other.typeId !== block.typeId || ownership.get(other.location)) continue;
    const s = other.permutation.getAllStates();
    if ("head_piece_bit" in states && (s.head_piece_bit === states.head_piece_bit || s.direction !== states.direction)) continue;
    result.push(other); break;
  }
  return result;
}

world.afterEvents.playerPlaceBlock.subscribe(event => guarded(() => {
  if (!managed(event.block)) return;
  if (!ready || failed) throw Error("Placement observed while repair storage is unavailable");
  const cached = placementItems.get(event.player.id);
  placementItems.delete(event.player.id);
  const item = cached?.tick === system.currentTick ? packItem(cached.stack, true) : packItem(event.block.getItemStack(1, true), true);
  if (item) item.amount = 1;
  const group = placementGroup(event.block);
  for (let i = 0; i < group.length; i++) ownership.register(
    { ...group[i].location }, event.player.id, permutationData(group[i]),
    { ...item, amount: i === 0 ? 1 : 0 },
    group.filter((_, n) => n !== i).map(b => ({ ...b.location })),
  );
}));

function resumePending() {
  let count = 0;
  for (const ref of store.pending.values()) {
    if (count++ >= config.removalBlocksPerTick) break;
    const entry = store.shards.get(ref.shard).returns[ref.token];
    let block;
    try { block = dimension().getBlock(entry.position); } catch { continue; }
    if (!block) continue;
    if (block.isAir) ownership.finishReturn(ref);
    else if (samePermutation(block, entry.permutation)) {
      clearWithoutDrops(block);
      ownership.finishReturn(ref);
    } // Changed blocks stay journaled for admin reconciliation; never overwrite them.
  }
}

system.runInterval(() => guarded(() => {
  placementItems.clear();
  if (!ready || failed) return;
  if (store.pending.size) resumePending();
  if (!store.dirtyRegions.size) return; // No player query, block reads or scan when idle.
  repair.poll(Date.now(), players());
  if (repair.active.size) wake();
}), config.pollTicks);

function claim(player) {
  if (!ready || failed || !player.isValid || player.dimension.id !== IDS.dimension) return;
  const container = player.getComponent("minecraft:inventory")?.container;
  if (!container) return;
  const count = lostFound.claim(player.id, item => {
    const leftover = container.addItem(unpackItem(item));
    return leftover ? { ...item, amount: leftover.amount } : undefined;
  });
  const pending = lostFound.entries(player.id);
  const uncertain = pending.filter(row => row.entry.status === "delivering").length;
  player.sendMessage(`§aLost & Found: ${count}個を返却しました。保管中 ${pending.length}件。`);
  if (uncertain) player.sendMessage(`§e返却中断 ${uncertain}件は重複防止のため保留中です。管理者へ連絡してください。`);
}

system.afterEvents.scriptEventReceive.subscribe(event => {
  const player = event.sourceEntity;
  if (player?.typeId !== "minecraft:player" || player.dimension.id !== IDS.dimension) return;
  if (event.id === "pinene_pvp:lost_found") guarded(() => claim(player));
  if (event.id === "pinene_pvp:repair_status") player.sendMessage(
    `[repair] ready=${ready} paused=${failed} dirtyRegions=${store.dirtyRegions.size} restoring=${repair.active.size}`);
  if (event.id === "pinene_pvp:repair_mail") player.sendMessage(JSON.stringify(lostFound.entries(event.message || player.id)));
  if (event.id === "pinene_pvp:repair_reconcile") {
    // Operator-only /scriptevent; never infer delivery success after a crash.
    try {
      const { owner, shard, token, deliveredAmount } = JSON.parse(event.message);
      lostFound.reconcile(owner, { shard, token }, deliveredAmount);
      player.sendMessage("§a保留中の返却記録を更新しました。");
    } catch (error) { player.sendMessage(`§c返却記録の更新失敗: ${error}`); }
  }
  if (event.id !== "pinene_pvp:repair_gateway") return;
  // Script events require operator commands. Chest is only a private-mail gateway.
  guarded(() => {
    const block = dimension().getBlock(config.gateway);
    if (!block || (!block.isAir && !gateway(block.location))) {
      player.sendMessage("§e窓口の座標が未読み込み、または使用中です。configの座標を確認してください。");
      return;
    }
    block.setType("minecraft:chest");
    world.setDynamicProperty(gatewayKey, true);
    player.sendMessage("§aLost & Found窓口を設置しました。操作すると自分の返却品を受け取れます。");
  });
});
