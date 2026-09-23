// Ephemeral form identity only. GF ownership and battle state remain in v1 properties.
export class FormSessions {
  constructor() { this.identities = new Map(); this.open = new Map(); }
  identity(player) {
    if (!this.identities.has(player.id)) this.identities.set(player.id, {});
    return this.identities.get(player.id);
  }
  invalidate(player) { this.identities.set(player.id, {}); }
  forget(id) { this.identities.delete(id); this.open.delete(id); }
  begin(player) {
    if (this.open.has(player.id)) return null;
    const lock = {};
    this.open.set(player.id, lock);
    return lock;
  }
  end(player, lock) {
    // A disconnected player's old promise must not unlock a new session's form.
    if (this.open.get(player.id) === lock) this.open.delete(player.id);
  }
}
