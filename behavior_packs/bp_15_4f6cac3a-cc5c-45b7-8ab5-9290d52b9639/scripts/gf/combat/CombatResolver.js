import { requireActive } from "../core/RuntimeGate.js";
import { KEYS } from "../core/Persistence.js";
import { resolveDefense } from "./DefenseResolver.js";

export class CombatResolver {
  constructor(decks, applyDamage) {
    this.decks = decks;
    this.applyDamage = applyDamage;
    this.busy = new Set();
  }
  armManual(player, slot) {
    requireActive(player);
    const { config, battle } = this.decks.load(player);
    if (!battle || !Number.isInteger(slot) || slot < 0 || slot >= 5) throw new Error("Invalid hand slot");
    const copy = config.randomDeck.find(c => c.copyId === battle.hand[slot]);
    if (this.decks.registry.get(copy.cardId).category !== "defense") throw new Error("防御カードを選択してください。");
    player.setDynamicProperty(KEYS.manual, JSON.stringify({ configurationRevision: config.configurationRevision, copyId: copy.copyId }));
  }
  receive(target, attack, source) {
    requireActive(target);
    if (source) requireActive(source);
    if (this.busy.has(target.id)) throw new Error("GF damage recursion blocked");
    this.busy.add(target.id);
    try {
      const { config, battle } = this.decks.load(target);
      const manual = [];
      const automatic = [];
      if (config && battle) {
        let armed;
        try { armed = JSON.parse(target.getDynamicProperty(KEYS.manual) ?? "null"); } catch { armed = null; }
        const slot = armed?.configurationRevision === config.configurationRevision ? battle.hand.indexOf(armed.copyId) : -1;
        if (slot >= 0) {
          const copy = config.randomDeck.find(c => c.copyId === armed.copyId);
          manual.push({ ...copy, card: this.decks.registry.get(copy.cardId), consume: () => {
            this.decks.use(target, slot, () => {});
            target.setDynamicProperty(KEYS.manual, undefined);
          } });
        }
        for (const copy of config.autoDefense) automatic.push({ ...copy, card: this.decks.registry.get(copy.cardId) });
      }
      const result = resolveDefense(target, attack, manual, automatic, config?.settings.defensePriority);
      requireActive(target);
      if (source) requireActive(source);
      if (result.damage > 0) this.applyDamage(target, result.damage, source);
      return result;
    } finally { this.busy.delete(target.id); }
  }
  useHand(player, slot, target) {
    requireActive(player);
    const { config, battle } = this.decks.load(player);
    const copy = config?.randomDeck.find(c => c.copyId === battle?.hand[slot]);
    if (!copy) throw new Error("手札がありません。");
    const card = this.decks.registry.get(copy.cardId);
    if (card.category === "defense") { this.armManual(player, slot); return { armed: true }; }
    requireActive(target);
    if (target.id === player.id) throw new Error("自分自身は攻撃できません。");
    return this.decks.use(player, slot, definition => this.receive(target, { damage: definition.effect.damage, attributes: definition.attributes }, player));
  }
  useFixed(player, slot, target) {
    requireActive(player);
    requireActive(target);
    if (target.id === player.id || !Number.isInteger(slot) || slot < 0) throw new Error("Invalid fixed attack");
    const config = this.decks.configuration(player);
    const copy = config?.fixedAttack[slot];
    if (!copy) throw new Error("固定カードがありません。");
    const card = this.decks.registry.get(copy.cardId);
    return this.receive(target, { damage: card.effect.damage, attributes: card.attributes }, player);
  }
}
