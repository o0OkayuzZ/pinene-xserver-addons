import { positionKey, regionKey, shardKey } from "./repair_store.js";

export function nearRegion(location, key, config) {
  const [rx, rz] = key.split(",").map(Number);
  const x = Math.max(rx * config.regionSize - location.x, 0, location.x - (rx + 1) * config.regionSize);
  const z = Math.max(rz * config.regionSize - location.z, 0, location.z - (rz + 1) * config.regionSize);
  return x * x + z * z <= config.nearbyRadius ** 2;
}

// Regions query nearby player cells; never players x dirty blocks.
export function playerIndex(players, config) {
  const cells = new Map();
  for (const player of players) {
    const key = regionKey(player.location, config.regionSize);
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(player);
  }
  return key => {
    const [x, z] = key.split(",").map(Number);
    const range = Math.ceil(config.nearbyRadius / config.regionSize) + 1;
    const nearby = [];
    for (let dx = -range; dx <= range; dx++) for (let dz = -range; dz <= range; dz++) {
      for (const player of cells.get(`${x + dx},${z + dz}`) ?? []) {
        if (nearRegion(player.location, key, config)) nearby.push(player);
      }
    }
    return nearby;
  };
}

export function intersectsPlayer(p, player) {
  const q = player.location;
  return q.x + 0.4 > p.x && q.x - 0.4 < p.x + 1
    && q.z + 0.4 > p.z && q.z - 0.4 < p.z + 1
    && q.y + 2.1 > p.y && q.y < p.y + 1;
}

function occupiedCells(players) {
  const cells = new Set();
  for (const { location: p } of players) {
    for (let x = Math.floor(p.x - 0.4); x <= Math.floor(p.x + 0.4); x++)
      for (let y = Math.floor(p.y); y <= Math.floor(p.y + 2.1); y++)
        for (let z = Math.floor(p.z - 0.4); z <= Math.floor(p.z + 0.4); z++) cells.add(`${x},${y},${z}`);
  }
  return cells;
}

export class AutoRepair {
  constructor(store, config, engine) {
    this.store = store; this.config = config; this.engine = engine;
    this.active = new Map();
  }

  record(p, permutation, now) {
    const key = positionKey(p), shard = shardKey(p);
    if (this.store.get(p).placed[key]) throw Error("Owned blocks must go to Lost & Found");
    const region = this.store.ensureRegion(p, now);
    this.store.saveRegion(region, { lastPlayerNearbyAt: now, restorationState: "waiting", observedNearby: true });
    this.active.delete(region);
    this.store.edit(shard, data => { data.dirty[key] ??= permutation; });
  }

  poll(now, players) {
    if (!this.store.dirtyRegions.size) return;
    const nearby = playerIndex(players, this.config);
    for (const region of this.store.dirtyRegions.keys()) {
      const state = this.store.regions.get(region);
      if (nearby(region).length) {
        this.store.saveRegion(region, { lastPlayerNearbyAt: now, observedNearby: true, restorationState: "waiting" });
        this.active.delete(region);
      } else if (state.observedNearby || now < state.lastPlayerNearbyAt) {
        // First absent observation starts the full ten minutes (never early).
        this.store.saveRegion(region, { lastPlayerNearbyAt: now, observedNearby: false, restorationState: "waiting" });
        this.active.delete(region);
      } else if (now - state.lastPlayerNearbyAt >= this.config.absenceMs) {
        this.store.saveRegion(region, { restorationState: "restoring" });
        if (!this.active.has(region)) this.active.set(region, this.store.dirtyEntries(region));
      }
    }
  }

  tick(now, players) {
    if (!this.active.size) return 0;
    const nearby = playerIndex(players, this.config);
    const occupied = occupiedCells(players);
    let attempts = 0;
    const completed = new Map();
    const completedRegions = new Set();
    for (const [region, iterator] of this.active) {
      if (nearby(region).length) {
        this.store.saveRegion(region, { lastPlayerNearbyAt: now, observedNearby: true, restorationState: "waiting" });
        this.active.delete(region);
        continue;
      }
      while (attempts < this.config.blocksPerTick) {
        const next = iterator.next();
        if (next.done) { this.active.delete(region); break; }
        attempts++;
        const { shard, key, entry, position } = next.value;
        const current = this.store.shards.get(shard);
        if (!current?.dirty[key] || current.placed[key]) continue;
        if (occupied.has(key)) continue;
        try {
          // Unloaded or occupied coordinates remain dirty for the next poll.
          if (!this.engine.restore(position, entry)) continue;
          if (!completed.has(shard)) completed.set(shard, []);
          completed.get(shard).push(key);
          completedRegions.add(region);
        } catch { /* Includes unloaded chunks. No force-load / island scan. */ }
      }
      if (attempts >= this.config.blocksPerTick) break;
    }
    for (const [shard, keys] of completed) this.store.edit(shard, data => {
      for (const key of keys) delete data.dirty[key];
    });
    for (const region of completedRegions) if (!this.store.dirtyRegions.has(region)) {
      this.active.delete(region);
      this.store.saveRegion(region, { restorationState: "clean" });
    }
    return attempts;
  }
}
