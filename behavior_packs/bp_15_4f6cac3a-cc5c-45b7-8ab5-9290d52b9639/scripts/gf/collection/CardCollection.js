import { Persistence } from "../core/Persistence.js";
import { validateConfiguration } from "../core/CardValidator.js";

export const COLLECTION_KEY = "pinene_gf:collection_v1";
export const DECK_GROUPS = ["randomDeck", "fixedAttack", "autoDefense"];
export function deckUsage(config) {
  const counts = new Map();
  for (const group of DECK_GROUPS) for (const copy of config?.[group] ?? []) counts.set(copy.cardId, (counts.get(copy.cardId) ?? 0) + 1);
  return counts;
}
export class CardCollection {
  constructor(registry, persistence = new Persistence()) { this.registry = registry; this.persistence = persistence; }
  load(player) {
    const raw = player.getDynamicProperty(COLLECTION_KEY);
    if (raw === undefined) return { version: 1, revision: 0, cards: {} };
    let value;
    try { value = JSON.parse(raw); } catch { throw new Error("GF collection保存データが破損しています。元データを保持します。"); }
    if (value?.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1
      || !value.cards || typeof value.cards !== "object" || Array.isArray(value.cards)) throw new Error("Invalid collection");
    for (const [id, amount] of Object.entries(value.cards)) { this.registry.get(id); this.amount(amount); }
    return value;
  }
  amount(value) { if (!Number.isSafeInteger(value) || value <= 0) throw new Error("枚数は正の安全な整数が必要です。"); }
  production(id) { const card = this.registry.get(id); if (card.developmentOnly) throw new Error("開発専用カードは通常付与できません。"); return card; }
  configuration(player) {
    const config = this.persistence.readConfiguration(player);
    if (config) validateConfiguration(config, this.registry, this.persistence.fixedSlots(player));
    return config;
  }
  count(player, id) { this.registry.get(id); return this.load(player).cards[id] ?? 0; }
  has(player, id, amount = 1) { this.amount(amount); return this.count(player, id) >= amount; }
  availableForDeck(player, id) { return Math.max(0, this.count(player, id) - (deckUsage(this.configuration(player)).get(id) ?? 0)); }
  allOwned(player) {
    const collection = this.load(player);
    return this.registry.all({ includeTests: false }).filter(card => collection.cards[card.id]).map(card => ({ cardId: card.id, count: collection.cards[card.id] }));
  }
  change(player, id, amount, removing) {
    this.production(id); this.amount(amount);
    const old = this.load(player), owned = old.cards[id] ?? 0;
    const next = removing ? owned - amount : owned + amount;
    if (!Number.isSafeInteger(next) || next < 0 || old.revision === Number.MAX_SAFE_INTEGER) throw new Error("Collection count/revision overflow");
    if (removing && next < (deckUsage(this.configuration(player)).get(id) ?? 0)) throw new Error("デッキ使用枚数を下回る削除はできません。");
    const value = { version: 1, revision: old.revision + 1, cards: { ...old.cards } };
    if (next === 0) delete value.cards[id]; else value.cards[id] = next;
    // No mutable cache and one property write: a failed atomic setter keeps the old collection.
    this.persistence.write(player, COLLECTION_KEY, value);
    return value;
  }
  grant(player, id, amount) { return this.change(player, id, amount, false); }
  revoke(player, id, amount) { return this.change(player, id, amount, true); }
  validateOwnership(player, config, expectedRevision) {
    const collection = this.load(player);
    if (expectedRevision !== undefined && expectedRevision !== collection.revision) throw new Error("所有カードが更新されました。開き直してください。");
    const names = new Map();
    for (const [id, count] of deckUsage(config)) {
      const card = this.registry.get(id);
      if (count > (collection.cards[id] ?? 0)) throw new Error(`${card.name}: 所有枚数が不足しています。`);
      const total = (names.get(card.name) ?? 0) + count;
      if (total > 3) throw new Error(`${card.name}: 全領域合算で同名は最大3枚です。`);
      names.set(card.name, total);
    }
    return true;
  }
}
