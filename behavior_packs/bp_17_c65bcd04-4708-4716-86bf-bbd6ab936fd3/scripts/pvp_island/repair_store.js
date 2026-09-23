// World dynamic properties are the journal. Only the touched 4x4x4 shard is saved.
export const PREFIX = "pinene_pvp:repair_v1:";
export const positionKey = p => `${p.x},${p.y},${p.z}`;
export const parsePosition = key => {
  const [x, y, z] = key.split(",").map(Number);
  return { x, y, z };
};
export const regionKey = (p, size = 32) => `${Math.floor(p.x / size)},${Math.floor(p.z / size)}`;
export const shardKey = p => `${Math.floor(p.x / 4)},${Math.floor(p.y / 4)},${Math.floor(p.z / 4)}`;
const empty = () => ({ version: 1, dirty: {}, placed: {}, returns: {} });
function utf8Size(text) {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    bytes += code <= 0x7f ? 1 : code <= 0x7ff ? 2 : code <= 0xffff ? 3 : 4;
  }
  return bytes;
}

export class RepairStore {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
    this.shards = new Map();
    this.regions = new Map();
    this.dirtyRegions = new Map();
    this.mail = new Map();
    this.pending = new Map();
  }

  load(now) {
    for (const id of this.storage.getDynamicPropertyIds()) {
      if (!id.startsWith(PREFIX)) continue;
      const value = JSON.parse(this.storage.getDynamicProperty(id));
      if (id.startsWith(PREFIX + "s:")) {
        if (value.version !== 1 || !value.dirty || !value.placed || !value.returns) throw Error(`Invalid repair shard: ${id}`);
        this.shards.set(id.slice((PREFIX + "s:").length), value);
      } else if (id.startsWith(PREFIX + "r:")) {
        if (value.size !== this.config.regionSize) throw Error("Migrate repair regions before changing regionSize");
        this.regions.set(id.slice((PREFIX + "r:").length), value);
      }
    }
    for (const [key, value] of this.shards) this.index(key, value);
    // Offline time cannot prove absence. Restart the grace period conservatively.
    for (const key of this.dirtyRegions.keys()) this.saveRegion(key, {
      lastPlayerNearbyAt: now, restorationState: "waiting", observedNearby: true,
    });
  }

  saveRegion(key, changes) {
    const value = { size: this.config.regionSize, ...this.regions.get(key), ...changes };
    this.storage.setDynamicProperty(PREFIX + "r:" + key, JSON.stringify(value));
    this.regions.set(key, value);
    return value;
  }

  ensureRegion(p, now) {
    const key = regionKey(p, this.config.regionSize);
    if (!this.regions.has(key)) this.saveRegion(key, {
      lastPlayerNearbyAt: now, restorationState: "waiting", observedNearby: true,
    });
    return key;
  }

  index(key, value) {
    // Remove only this shard's previous index entries, never traverse all blocks.
    const [x, , z] = key.split(",").map(n => Number(n) * 4);
    const region = regionKey({ x, z }, this.config.regionSize);
    let shards = this.dirtyRegions.get(region);
    if (Object.keys(value.dirty).length) {
      if (!shards) this.dirtyRegions.set(region, shards = new Set());
      shards.add(key);
    } else if (shards) {
      shards.delete(key);
      if (!shards.size) this.dirtyRegions.delete(region);
    }
    const previous = this.shards.get(key);
    for (const [token, entry] of Object.entries(previous?.returns ?? {})) {
      this.mail.get(entry.owner)?.delete(`${key}/${token}`);
      if (!this.mail.get(entry.owner)?.size) this.mail.delete(entry.owner);
      this.pending.delete(`${key}/${token}`);
    }
    for (const [token, entry] of Object.entries(value.returns)) {
      if (!this.mail.has(entry.owner)) this.mail.set(entry.owner, new Map());
      this.mail.get(entry.owner).set(`${key}/${token}`, { shard: key, token });
      if (entry.status === "removing") this.pending.set(`${key}/${token}`, { shard: key, token });
    }
  }

  edit(key, mutate) {
    const value = JSON.parse(JSON.stringify(this.shards.get(key) ?? empty()));
    mutate(value);
    const raw = JSON.stringify(value);
    if (utf8Size(raw) > 30000) throw Error(`Repair shard full: ${key}; block left intact`);
    const vacant = !Object.keys(value.dirty).length && !Object.keys(value.placed).length && !Object.keys(value.returns).length;
    this.storage.setDynamicProperty(PREFIX + "s:" + key, vacant ? undefined : raw);
    this.index(key, value);
    if (vacant) this.shards.delete(key); else this.shards.set(key, value);
  }

  get(p) { return this.shards.get(shardKey(p)) ?? empty(); }

  *dirtyEntries(region) {
    for (const shard of this.dirtyRegions.get(region) ?? []) {
      for (const [key, entry] of Object.entries(this.shards.get(shard)?.dirty ?? {})) {
        yield { shard, key, entry, position: parsePosition(key) };
      }
    }
  }
}
