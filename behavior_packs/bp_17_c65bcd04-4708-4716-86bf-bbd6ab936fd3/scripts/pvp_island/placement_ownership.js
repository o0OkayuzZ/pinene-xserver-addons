import { positionKey, shardKey } from "./repair_store.js";

export class PlacementOwnership {
  constructor(store) { this.store = store; }
  get(p) { return this.store.get(p).placed[positionKey(p)]; }
  register(p, owner, permutation, item, companions = []) {
    if (!owner || !item?.typeId) throw Error("Missing placement owner/item");
    this.store.edit(shardKey(p), data => {
      data.placed[positionKey(p)] = { owner, permutation, item, companions };
    });
  }
  beginReturn(p, contents, now, permutation = this.get(p)?.permutation) {
    const placed = this.get(p);
    if (!placed) throw Error("No placement ownership");
    const key = positionKey(p), shard = shardKey(p);
    // One pending removal per coordinate; duplicate events cannot credit twice.
    const existing = Object.entries(this.store.get(p).returns)
      .find(([, value]) => value.status === "removing" && positionKey(value.position) === key);
    if (existing) return { shard, token: existing[0] };
    let token = `${key}@${now}`;
    while (this.store.get(p).returns[token]) token += "+";
    this.store.edit(shard, data => {
      data.returns[token] = { owner: placed.owner, position: p, permutation,
        items: [...(placed.item.amount > 0 ? [placed.item] : []), ...contents], status: "removing" };
    });
    return { shard, token };
  }
  finishReturn(ref) {
    this.store.edit(ref.shard, data => {
      const entry = data.returns[ref.token];
      delete data.placed[positionKey(entry.position)];
      if (entry.items.length) entry.status = "ready";
      else delete data.returns[ref.token];
    });
  }
}
