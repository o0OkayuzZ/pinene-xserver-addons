import { CardRegistry } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/CardRegistry.js';
import { DeckManager } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/DeckManager.js';
import { CombatResolver } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/combat/CombatResolver.js';
import { FormSessions } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/FormSessions.js';
import { CaseActions } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseActions.js';
import { createCaseMenu } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseMenu.js';
import { KEYS } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/Persistence.js';
export { KEYS, CardRegistry, DeckManager, CombatResolver, FormSessions, CaseActions };
export const DIMENSION = 'pinene_pvp:pvp_island';

export function player(id = 'alice', dimension = DIMENSION, properties = new Map()) {
  const inventory = Array(36);
  const entity = {
    id, typeId: 'minecraft:player', isValid: true, dimension: { id: dimension }, properties,
    messages: [], writes: [], targets: [], damage: [], inventory,
    getDynamicProperty: key => properties.get(key),
    setDynamicProperty(key, value) { this.writes.push(key); if (value === undefined) properties.delete(key); else properties.set(key, value); },
    sendMessage(message) { this.messages.push(message); },
    getEntitiesFromViewDirection(options) { this.lastRayOptions = options; return this.targets.map(entity => ({ entity })); },
    applyDamage(amount, options) { this.damage.push({ amount, options }); return true; },
    getComponent(id) { return id === 'minecraft:inventory' ? { container: this.container } : undefined; },
  };
  entity.container = { size: inventory.length, getItem: i => inventory[i], setItem: (i, item) => { inventory[i] = item; } };
  return entity;
}

export function forms() {
  const shown = [], pending = [];
  class Form {
    constructor() { this.buttons = []; }
    title(value) { this.titleText = value; return this; }
    body(value) { this.bodyText = value; return this; }
    button(value) { this.buttons.push(value); return this; }
    textField(...args) { (this.fields ??= []).push(args); return this; }
    show(player) { shown.push({ form: this, player }); return new Promise(resolve => pending.push(resolve)); }
  }
  return { Form, shown, pending, respond(value) { if (!pending.length) throw Error('No pending form'); pending.shift()(value); } };
}

export function fixture() {
  const actor = player(), target = player('bob'); actor.targets = [target];
  const registry = new CardRegistry(), decks = new DeckManager(registry, undefined, () => 0.3);
  const config = {
    randomDeck: registry.all().flatMap(card => [card, card, card]).slice(0, 16).map((card, i) => ({ copyId: `copy_${i}`, cardId: card.id })),
    fixedAttack: [{ copyId: 'fixed_0', cardId: 'gf:test_attack' }],
    autoDefense: [{ copyId: 'auto_0', cardId: 'gf:blue_shield' }, { copyId: 'auto_1', cardId: 'gf:red_shield' }, { copyId: 'auto_2', cardId: 'gf:colorless_guard' }],
    settings: { defensePriority: 'manual_first' },
  };
  decks.saveConfiguration(actor, config);
  const sessions = new FormSessions();
  const combat = new CombatResolver(decks, (t, damage, source) => t.applyDamage(damage, { source }));
  const actions = new CaseActions(decks, combat, sessions);
  const ui = forms(), cases = createCaseMenu(decks, actions, sessions, () => new ui.Form());
  const f = { actor, target, registry, decks, config, sessions, combat, actions, ui, cases };
  f.arrange = (ids = ['gf:test_attack', 'gf:red_shield', 'gf:blue_attack', 'gf:blue_shield', 'gf:colorless_guard'], who = actor) => {
    const config = decks.configuration(who), remaining = [...config.randomDeck];
    const hand = ids.map(id => remaining.splice(remaining.findIndex(c => c.cardId === id), 1)[0].copyId);
    const battle = { version: 1, configurationRevision: config.configurationRevision, hand, drawPile: remaining.map(c => c.copyId), discardPile: [], resolving: null };
    who.setDynamicProperty(KEYS.battle, JSON.stringify(battle));
    return battle;
  };
  f.arrange(); actor.writes.length = 0;
  return f;
}
