import { requireActive, isActive } from "../core/RuntimeGate.js";
import { validateConfiguration, validateBattle } from "../core/CardValidator.js";
import { createBattle, clone } from "../core/CardState.js";
import { Persistence, KEYS } from "../core/Persistence.js";
import { beginUse, finishUse } from "./HandManager.js";

export class DeckManager {
  constructor(registry, persistence = new Persistence(), random = Math.random, collection = null) {
    this.collection = collection;
    this.registry = registry;
    this.persistence = persistence;
    this.random = random;
    this.busy = new Set();
  }
  configuration(player) {
    const config = this.persistence.readConfiguration(player);
    if (config !== null) validateConfiguration(config, this.registry, this.persistence.fixedSlots(player));
    return config;
  }
  saveConfiguration(player, input, expectedRevision, expectedCollectionRevision) {
    this.activations?.assertAvailable(player);
    if (this.busy.has(player.id)) throw new Error("カード処理中です。");
    const old = this.configuration(player);
    if (expectedRevision !== undefined && expectedRevision !== (old?.configurationRevision ?? 0)) throw new Error("構成が更新されました。開き直してください。");
    const config = { version: 1, configurationRevision: (old?.configurationRevision ?? 0) + 1, randomDeck: clone(input.randomDeck), fixedAttack: clone(input.fixedAttack), autoDefense: clone(input.autoDefense), settings: clone(input.settings) };
    validateConfiguration(config, this.registry, this.persistence.fixedSlots(player));
    this.collection?.validateOwnership(player, config, expectedCollectionRevision);
    if (old && JSON.stringify({ ...old, configurationRevision: 0 }) === JSON.stringify({ ...config, configurationRevision: 0 })) return old;
    this.persistence.write(player, KEYS.configuration, config);
    // Do not initialize/shuffle outside the gate. Revision invalidates old battle lazily.
    return config;
  }
  load(player) {
    this.activations?.recover(player);
    const config = this.configuration(player);
    if (!config) return { config: null, battle: null, active: isActive(player) };
    let battle = this.persistence.readBattle(player);
    const valid = validateBattle(config, battle);
    if (!isActive(player)) return { config, battle, active: false, valid };
    if (this.busy.has(player.id)) throw new Error("カード処理中です。");
    if (!valid) {
      battle = createBattle(config, this.random);
      this.persistBattle(player, config, battle);
    } else if (battle.resolving !== null) {
      battle = finishUse(battle, this.random);
      this.persistBattle(player, config, battle);
    }
    return { config, battle, active: true, valid: true };
  }
  persistBattle(player, config, battle) {
    requireActive(player);
    if (!validateBattle(config, battle)) throw new Error("Card invariant failed");
    this.persistence.write(player, KEYS.battle, battle);
  }
  use(player, slot, effect) {
    this.activations?.beforeUse(player, slot);
    requireActive(player);
    const { config, battle } = this.load(player);
    if (!battle) throw new Error("デッキを登録してください。");
    const next = beginUse(battle, slot);
    const card = this.registry.get(config.randomDeck.find(copy => copy.copyId === next.resolving).cardId);
    this.busy.add(player.id);
    try {
      this.persistBattle(player, config, next);
      try {
        requireActive(player);
        const result = effect(card);
        if (result?.then) throw new Error("GF effects must be synchronous");
        return result;
      } finally {
        if (isActive(player)) this.persistBattle(player, config, finishUse(next, this.random));
      }
    } finally { this.busy.delete(player.id); }
  }
}
