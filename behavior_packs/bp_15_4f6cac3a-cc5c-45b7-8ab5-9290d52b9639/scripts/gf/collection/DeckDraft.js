import { COLLECTION_KEY, DECK_GROUPS, deckUsage } from "./CardCollection.js";
import { KEYS } from "../core/Persistence.js";

// Drafts are local UI state, never a partially valid persisted configuration.
export class DeckDraft {
  constructor(player, decks, collection, sessions) {
    this.player = player; this.decks = decks; this.collection = collection; this.sessions = sessions;
    const config = decks.configuration(player);
    this.revision = config?.configurationRevision ?? 0;
    this.collectionRevision = collection.load(player).revision;
    this.identity = sessions.identity(player); this.dimension = player.dimension.id;
    this.rawConfig = player.getDynamicProperty(KEYS.configuration);
    this.rawCollection = player.getDynamicProperty(COLLECTION_KEY);
    this.capacity = decks.persistence.fixedSlots(player);
    this.value = JSON.parse(JSON.stringify(config ?? { randomDeck: [], fixedAttack: [], autoDefense: [], settings: { defensePriority: "manual_first" } }));
    this.sequence = 0;
  }
  assertCurrent() {
    const p = this.player;
    if (p.isValid === false || this.identity !== this.sessions.identity(p) || this.dimension !== p.dimension.id
      || this.rawConfig !== p.getDynamicProperty(KEYS.configuration) || this.rawCollection !== p.getDynamicProperty(COLLECTION_KEY)
      || this.capacity !== this.decks.persistence.fixedSlots(p)) throw new Error("構成・所有数・セッションが変化しました。編集を開き直してください。");
  }
  add(group, id) {
    this.assertCurrent();
    if (!DECK_GROUPS.includes(group)) throw new Error("Invalid deck group");
    const card = this.collection.production(id), cards = this.value[group];
    const cap = group === "randomDeck" ? 16 : group === "fixedAttack" ? this.capacity : 9;
    if (cards.length >= cap) throw new Error("枠が満杯です。");
    if (group === "fixedAttack" && card.category !== "attack" || group === "autoDefense" && (card.category !== "defense" || card.activation === "manual")) throw new Error("この領域へ登録できないカードです。");
    const used = deckUsage(this.value);
    if ((used.get(id) ?? 0) >= this.collection.count(this.player, id)) throw new Error("所有枚数が不足しています。");
    let sameName = 0;
    for (const [cardId, count] of used) if (this.collection.registry.get(cardId).name === card.name) sameName += count;
    if (sameName >= 3) throw new Error("同名は合算3枚までです。");
    const ids = new Set(DECK_GROUPS.flatMap(key => this.value[key].map(copy => copy.copyId)));
    let copyId;
    do { copyId = `owned_${this.revision + 1}_${++this.sequence}`; } while (ids.has(copyId));
    cards.push({ copyId, cardId: id });
  }
  remove(group, index) {
    this.assertCurrent();
    if (!DECK_GROUPS.includes(group) || !Number.isInteger(index) || !this.value[group][index]) throw new Error("Invalid draft slot");
    this.value[group].splice(index, 1);
  }
  moveUp(group, index) {
    this.assertCurrent();
    if (!DECK_GROUPS.includes(group) || !Number.isInteger(index) || index < 1 || !this.value[group][index]) throw new Error("Invalid draft order");
    [this.value[group][index - 1], this.value[group][index]] = [this.value[group][index], this.value[group][index - 1]];
  }
  save() {
    this.assertCurrent();
    const saved = this.decks.saveConfiguration(this.player, this.value, this.revision, this.collectionRevision);
    this.sessions.invalidate(this.player);
    return saved;
  }
}
