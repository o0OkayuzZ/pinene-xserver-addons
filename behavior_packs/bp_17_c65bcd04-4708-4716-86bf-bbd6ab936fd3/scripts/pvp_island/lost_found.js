// Mail remains private to the placing player's persistent id, including offline owners.
export class LostFound {
  constructor(store) { this.store = store; }
  entries(owner) {
    return [...(this.store.mail.get(owner)?.values() ?? [])].map(ref => ({
      ...ref, entry: this.store.shards.get(ref.shard).returns[ref.token],
    }));
  }
  reconcile(owner, { shard, token }, deliveredAmount) {
    if (!Number.isInteger(deliveredAmount) || deliveredAmount < 0) throw Error("Explicit deliveredAmount required after inventory review");
    const entry = this.store.shards.get(shard)?.returns[token];
    if (entry?.owner !== owner || entry.status !== "delivering") throw Error("No matching interrupted delivery");
    if (deliveredAmount > entry.items[0].amount) throw Error("Delivered amount exceeds pending stack");
    this.store.edit(shard, data => {
      const mail = data.returns[token];
      mail.items[0].amount -= deliveredAmount;
      if (!mail.items[0].amount) mail.items.shift();
      if (!mail.items.length) delete data.returns[token]; else mail.status = "ready";
    });
  }
  claim(owner, give, limit = 24) {
    let delivered = 0, attempted = 0;
    for (const { shard, token, entry } of this.entries(owner)) {
      if (entry.status !== "ready") continue;
      while (attempted < limit) {
        const current = this.store.shards.get(shard)?.returns[token];
        if (!current?.items.length) break;
        const item = current.items[0];
        // Write-ahead delivery marker. Interrupted deliveries are quarantined,
        // not blindly retried (inventory + world properties are not transactional).
        this.store.edit(shard, data => { data.returns[token].status = "delivering"; });
        attempted++;
        let leftover;
        try { leftover = give(item); }
        catch { throw Error(`Lost & Found delivery interrupted (${shard}/${token}); retained for administrator reconciliation`); }
        delivered += item.amount - (leftover?.amount ?? 0);
        this.store.edit(shard, data => {
          const mail = data.returns[token];
          if (leftover) mail.items[0] = leftover; else mail.items.shift();
          if (!mail.items.length) delete data.returns[token]; else mail.status = "ready";
        });
        if (leftover) return delivered;
      }
      if (attempted >= limit) break;
    }
    return delivered;
  }
}
