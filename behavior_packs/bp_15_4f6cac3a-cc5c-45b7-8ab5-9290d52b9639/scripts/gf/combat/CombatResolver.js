import { attackContext, normalizeAttack } from "../effects/AttackEffects.js";
import { requireActive } from "../core/RuntimeGate.js";
import { KEYS } from "../core/Persistence.js";
import { resolveDefense } from "./DefenseResolver.js";

export class CombatResolver {
  constructor(decks, applyDamage, feedback = {}) {
    this.feedback = feedback;
    this.decks = decks;
    this.applyDamage = applyDamage;
    this.busy = new Set();
    this.reflections = [];
    this.deferred = 0;
    this.draining = false;
  }
  armManual(player, slot) {
    requireActive(player);
    const { config, battle } = this.decks.load(player);
    if (!battle || !Number.isInteger(slot) || slot < 0 || slot >= 5) throw new Error("Invalid hand slot");
    const copy = config.randomDeck.find(c => c.copyId === battle.hand[slot]);
    if (this.decks.registry.get(copy.cardId).category !== "defense") throw new Error("防御カードを選択してください。");
    player.setDynamicProperty(KEYS.manual, JSON.stringify({ configurationRevision: config.configurationRevision, copyId: copy.copyId }));
  }
  drainReflections() {
    if (this.deferred || this.busy.size || this.draining) return;
    this.draining = true;
    try {
      while (this.reflections.length) {
        const attack = this.reflections.shift();
        if (attack.source?.isValid === false || attack.target?.isValid === false) continue;
        this.receive(attack.target, attack, attack.source);
      }
    } finally { this.draining = false; }
  }
  transaction(effect) {
    this.deferred++;
    try { return effect(); } finally { this.deferred--; this.drainReflections(); }
  }
  attack(card, source, target, options) {
    return this.receive(target, attackContext(card, source, target, options), source);
  }
  receive(target, attack, source) {
    attack = normalizeAttack(attack, source, target);
    source = attack.source;
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
      if (result.damage > 0) this.applyDamage(target, result.damage, source, attack);
      else if (result.applied.length) this.feedback.block?.(target, attack);
      this.reflections.push(...(result.reflections ?? []));
      return result;
    } finally { this.busy.delete(target.id); this.drainReflections(); }
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
    if (card.effect.type === "railgun") throw new Error("Railgun requires an activation reservation");
    return this.transaction(() => this.decks.use(player, slot, definition => this.attack(definition, player, target)));
  }
  useFixed(player, slot, target) {
    requireActive(player);
    requireActive(target);
    if (target.id === player.id || !Number.isInteger(slot) || slot < 0) throw new Error("Invalid fixed attack");
    const config = this.decks.configuration(player);
    const copy = config?.fixedAttack[slot];
    if (!copy) throw new Error("固定カードがありません。");
    const card = this.decks.registry.get(copy.cardId);
    if (card.effect.type === "railgun") throw new Error("Railgun requires an activation reservation");
    return this.transaction(() => this.attack(card, player, target));
  }
}
