import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture, player, KEYS, CaseActions, CardRegistry, DIMENSION } from './gf-fixture.mjs';
import { balance } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cards/balance.js';
import { powerDamage, attackContext } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/AttackEffects.js';
import { PendingActivations, PENDING_KEY } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/PendingActivations.js';
import { ActivationResources, COOLDOWN_KEY } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/effects/ActivationResources.js';
import { beginUse } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/HandManager.js';
import { installRuntime } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/Runtime.js';
import { createCaseMenu } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseMenu.js';

function setup(overrides = {}) {
  const f = fixture();
  f.registry.cards.set('gf:railgun', { ...f.registry.get('gf:railgun'), effect: { type: 'railgun', parameters: { ...balance.railgun, ...overrides } } });
  const input = structuredClone(f.config);
  ['gf:railgun', 'gf:black_flash_arrow', 'gf:accelerator'].forEach((id, i) => input.randomDeck[i].cardId = id);
  input.fixedAttack[0].cardId = 'gf:railgun';
  f.decks.saveConfiguration(f.actor, input);
  const config = f.decks.configuration(f.actor);
  const battle = { version: 1, configurationRevision: config.configurationRevision, hand: config.randomDeck.slice(0, 5).map(c => c.copyId),
    drawPile: config.randomDeck.slice(5).map(c => c.copyId), discardPile: [], resolving: null };
  f.actor.setDynamicProperty(KEYS.battle, JSON.stringify(battle));
  let id = 0;
  const tasks = new Map(), scheduler = {
    runTimeout(callback, ticks) { tasks.set(++id, { callback, ticks }); return id; },
    clearRun(id) { tasks.delete(id); },
    runInterval() { throw Error('No polling'); },
  };
  f.now = 10000;
  const resources = new ActivationResources(() => f.now);
  f.activations = new PendingActivations(f.decks, f.combat, f.sessions, scheduler, resources);
  f.actions = new CaseActions(f.decks, f.combat, f.sessions, f.activations);
  f.cases = createCaseMenu(f.decks, f.actions, f.sessions, () => new f.ui.Form());
  f.scheduler = scheduler; f.resources = resources; f.tasks = tasks;
  f.actor.getEntitiesFromViewDirection = options => { f.actor.lastRayOptions = options; return f.actor.targets.map((entity, i) => ({ entity, distance: i + 1 })); };
  f.fire = () => { const [id, task] = tasks.entries().next().value; tasks.delete(id); task.callback(); return task.callback; };
  f.battle = () => f.decks.persistence.readBattle(f.actor);
  return f;
}
function invariant(f, actor = f.actor) {
  const b = f.decks.load(actor).battle, ids = [...b.hand.filter(Boolean), ...b.drawPile, ...b.discardPile, ...(b.resolving ? [b.resolving] : [])];
  assert.equal(b.hand.length, 5); assert.equal(ids.length, 16); assert.equal(new Set(ids).size, 16);
}
function defender(f, who = f.target, copies = 1) {
  const input = structuredClone(f.config); input.autoDefense = [];
  for (let i = 0; i < copies; i++) input.randomDeck[i].cardId = 'gf:accelerator';
  f.decks.saveConfiguration(who, input);
  const c = f.decks.configuration(who);
  who.setDynamicProperty(KEYS.battle, JSON.stringify({ version: 1, configurationRevision: c.configurationRevision,
    hand: c.randomDeck.slice(0, 5).map(c => c.copyId), drawPile: c.randomDeck.slice(5).map(c => c.copyId), discardPile: [], resolving: null }));
  f.combat.armManual(who, 0);
}
function runtime(f) {
  const callbacks = {}, event = name => ({ subscribe(fn) { callbacks[name] = fn; } });
  const world = { getAllPlayers: () => [f.actor], afterEvents: Object.fromEntries(['worldLoad', 'playerSpawn', 'playerDimensionChange', 'playerLeave'].map(name => [name, event(name)])) };
  const system = { ...f.scheduler, run(fn) { callbacks.start = fn; }, beforeEvents: { startup: event('startup') }, afterEvents: { scriptEventReceive: event('scriptEventReceive') } };
  installRuntime({ world, system, ...f, decks: f.decks, sessions: f.sessions, cases: f.cases, menu() {}, createItem() {} });
  return callbacks;
}
const ammo = (amount = 2) => ({ typeId: 'minecraft:iron_nugget', amount, clone() { return ammo(this.amount); } });

test('production registry retains six legacy cards and exposes three declarative production definitions', () => {
  const r = new CardRegistry(); assert.equal(r.all().length, 9); assert.equal(r.all({ includeTests: false }).length, 3);
  assert.deepEqual(r.get('gf:black_flash_arrow').attributes, ['purple']);
  assert.equal(r.get('gf:black_flash_arrow').effect.parameters.exponent, 2.5);
  assert.deepEqual(r.get('gf:railgun').attributes, ['yellow']); assert.equal(balance.railgun.maxRange, 64);
  const d = r.get('gf:accelerator'); assert.deepEqual(d.attributes, ['purple']); assert.equal(d.activation, 'manual'); assert.equal(d.modes.thrown.enabled, false);
});
test('power damage has finite output, cap and configurable external base damage', () => {
  assert.ok(Math.abs(powerDamage(8, 2.5, .1, 40) - 18.101933598) < 1e-6);
  assert.ok(powerDamage(Number.MAX_VALUE, 2.5, .1, 40) <= 40);
  assert.equal(powerDamage(0, 2.5, .1, 40), 0);
  const f = setup(); assert.equal(attackContext(f.registry.get('gf:black_flash_arrow'), f.actor, f.target, { baseDamage: 0 }).damage, 0);
});
test('power damage rejects negative, NaN, infinite and invalid exponent/cap inputs', () => {
  for (let i = 0; i < 4; i++) for (const invalid of [-1, NaN, Infinity]) {
    const values = [8, 2.5, .1, 40]; values[i] = invalid; assert.throws(() => powerDamage(...values));
  }
  assert.throws(() => powerDamage(8, 0, .1, 40)); assert.throws(() => powerDamage(8, 2.5, .1, 0));
});
test('black flash uses the ordinary hand journal, replenishes selected slot, and preserves sixteen copies', () => {
  const f = setup(), before = f.battle(); f.actions.useHand(f.actor, 1);
  assert.equal(f.target.damage.length, 1); assert.ok(Number.isFinite(f.target.damage[0].amount));
  assert.equal(f.battle().discardPile[0], before.hand[1]); invariant(f);
});
test('black flash without a target makes no persistence writes or card consumption', () => {
  const f = setup(); f.actor.targets = []; const before = [...f.actor.properties]; f.actor.writes.length = 0;
  assert.throws(() => f.actions.useHand(f.actor, 1)); assert.deepEqual([...f.actor.properties], before); assert.equal(f.actor.writes.length, 0);
});
test('legacy simple attack contexts remain supported without attribute damage multipliers', () => {
  const f = setup(); for (const attribute of ['colorless', 'red', 'blue', 'yellow', 'purple']) f.combat.receive(f.target, { damage: 7, attributes: [attribute] }, f.actor);
  assert.deepEqual(f.target.damage.map(d => d.amount), [7, 7, 7, 7, 7]);
});
test('railgun reserves an unchanged hand and uses exactly one timeout', () => {
  const f = setup(), before = f.battle(); assert.deepEqual(f.actions.useHand(f.actor, 0), { pending: true });
  assert.deepEqual(f.battle(), before); assert.equal(f.tasks.size, 1); assert.equal([...f.tasks.values()][0].ticks, balance.railgun.chargeTicks);
  assert.equal(JSON.parse(f.actor.getDynamicProperty(PENDING_KEY)).copyId, before.hand[0]);
  assert.equal(f.actor.lastRayOptions.maxDistance, 64); assert.equal(f.actor.lastRayOptions.ignoreBlockCollision, false);
  assert.throws(() => f.actions.useHand(f.actor, 0)); assert.throws(() => f.decks.use(f.actor, 0, () => {})); assert.equal(f.tasks.size, 1);
});
test('charge completes once even when the callback is delivered twice', () => {
  const f = setup(); f.actions.useHand(f.actor, 0); const callback = f.fire(); callback();
  assert.equal(f.target.damage.length, 1); assert.equal(f.target.damage[0].amount, 24);
  assert.equal(f.battle().discardPile.length, 1); assert.equal(f.actor.getDynamicProperty(PENDING_KEY), undefined); invariant(f);
});
test('cancel frees reservation without duplication or firing a stale timeout', () => {
  const f = setup(), before = f.battle(); f.actions.useHand(f.actor, 0); const callback = [...f.tasks.values()][0].callback;
  f.activations.cancel(f.actor.id); callback(); assert.deepEqual(f.battle(), before); assert.equal(f.target.damage.length, 0); assert.equal(f.tasks.size, 0); invariant(f);
});
test('disconnect event cancels immediately and does not depend on an entity still being valid', () => {
  const f = setup(), events = runtime(f), before = f.battle(); f.actions.useHand(f.actor, 0);
  f.actor.isValid = false; events.playerLeave({ playerId: f.actor.id }); assert.equal(f.tasks.size, 0); assert.deepEqual(f.battle(), before);
});
test('dimension leave and immediate reentry cannot resurrect a pending shot', () => {
  const f = setup(), events = runtime(f); f.actions.useHand(f.actor, 0); const callback = [...f.tasks.values()][0].callback;
  f.actor.dimension.id = 'minecraft:overworld'; events.playerDimensionChange({ player: f.actor });
  f.actor.dimension.id = DIMENSION; events.playerDimensionChange({ player: f.actor }); callback();
  assert.equal(f.target.damage.length, 0); assert.equal(f.activations.pending.size, 0); invariant(f);
});
test('completion independently checks disconnected and outside players', () => {
  for (const mutate of [f => f.actor.isValid = false, f => f.actor.dimension.id = 'minecraft:overworld']) {
    const f = setup(), before = f.battle(); f.actions.useHand(f.actor, 0); mutate(f); f.fire();
    assert.deepEqual(f.battle(), before); assert.equal(f.target.damage.length, 0);
  }
});
test('lost final ray or invalid target cancels without ammo/cooldown/card changes', () => {
  for (const mutate of [f => f.actor.targets = [], f => f.target.isValid = false]) {
    const f = setup({ ammoItemId: 'minecraft:iron_nugget' }); f.actor.inventory[0] = ammo(); const before = f.battle();
    f.actions.useHand(f.actor, 0); mutate(f); f.fire(); assert.deepEqual(f.battle(), before);
    assert.equal(f.actor.inventory[0].amount, 2); assert.equal(f.actor.getDynamicProperty(COOLDOWN_KEY), undefined);
  }
});
test('script reload clears pending metadata, preserves v1 hand and schedules no replay', () => {
  const f = setup(), before = f.battle(); f.actions.useHand(f.actor, 0);
  const reloaded = new PendingActivations(f.decks, f.combat, f.sessions, f.scheduler, f.resources);
  reloaded.recover(f.actor); assert.equal(f.actor.getDynamicProperty(PENDING_KEY), undefined); assert.deepEqual(f.battle(), before);
  assert.equal(reloaded.pending.size, 0); f.fire(); // Even an artificially retained old callback is stale.
  assert.equal(f.target.damage.length, 0); invariant(f);
});
test('resolving journal plus stale pending recovers to sixteen copies without damage replay', () => {
  const f = setup(); f.actor.setDynamicProperty(PENDING_KEY, '{"version":1}');
  f.actor.setDynamicProperty(KEYS.battle, JSON.stringify(beginUse(f.battle(), 0)));
  const loaded = f.decks.load(f.actor); assert.equal(loaded.battle.resolving, null); assert.equal(loaded.battle.discardPile.length, 1);
  assert.equal(f.target.damage.length, 0); invariant(f);
});
test('ammo shortage initially causes no writes, card use, cooldown or timer', () => {
  const f = setup({ ammoItemId: 'minecraft:iron_nugget' }), before = [...f.actor.properties];
  assert.throws(() => f.actions.useHand(f.actor, 0)); assert.deepEqual([...f.actor.properties], before); assert.equal(f.tasks.size, 0);
});
test('ammo lost during charge also cancels without using the card', () => {
  const f = setup({ ammoItemId: 'minecraft:iron_nugget' }); f.actor.inventory[0] = ammo(); const before = f.battle();
  f.actions.useHand(f.actor, 0); f.actor.inventory[0] = undefined; f.fire(); assert.deepEqual(f.battle(), before);
  assert.equal(f.target.damage.length, 0); assert.equal(f.actor.getDynamicProperty(COOLDOWN_KEY), undefined);
});
test('one coin is consumed per shot regardless of penetration, including final stack item', () => {
  for (const count of [1, 3]) {
    const f = setup({ ammoItemId: 'minecraft:iron_nugget' }); f.actor.inventory[0] = ammo(count); f.actor.targets = [f.target, player('third')];
    f.actions.useHand(f.actor, 0); f.fire(); assert.equal(f.actor.inventory[0]?.amount ?? 0, count - 1);
  }
});
test('penetration sorts ray hits, deduplicates targets and applies configured max target/damage curve', () => {
  const f = setup(), third = player('third'), fourth = player('fourth'), fifth = player('fifth');
  f.actor.getEntitiesFromViewDirection = () => [{ entity: fourth, distance: 3 }, { entity: f.target, distance: 1 }, { entity: f.target, distance: 1 }, { entity: third, distance: 2 }, { entity: fifth, distance: 4 }];
  f.actions.useHand(f.actor, 0); f.fire(); assert.deepEqual([f.target, third, fourth, fifth].map(p => p.damage.map(d => d.amount)), [[24], [18], [13.5], []]);
});
test('ray rejects out-of-range and nonfinite hits without starting a reservation', () => {
  const f = setup(); f.actor.getEntitiesFromViewDirection = () => [{ entity: f.target, distance: 65 }, { entity: f.target, distance: NaN }];
  assert.throws(() => f.actions.useHand(f.actor, 0)); assert.equal(f.tasks.size, 0);
});
test('cooldown is persisted, blocks random/fixed reuse and expires through an injected clock', () => {
  const f = setup(); f.actions.useHand(f.actor, 0); f.fire(); assert.throws(() => f.actions.useFixed(f.actor, 0));
  const reloaded = new ActivationResources(() => f.now); assert.throws(() => reloaded.preflight(f.actor, f.registry.get('gf:railgun')));
  f.now += 5000; f.actions.useFixed(f.actor, 0); f.fire(); assert.equal(f.target.damage.length, 2);
});
test('fixed railgun charges/fires without changing any hand or pile', () => {
  const f = setup(), before = f.battle(); f.actions.useFixed(f.actor, 0); f.fire(); assert.deepEqual(f.battle(), before); invariant(f);
});
test('configuration edits are rejected during reservation; stale external changes cancel safely', () => {
  const f = setup(); f.actions.useHand(f.actor, 0); assert.throws(() => f.decks.saveConfiguration(f.actor, f.config));
  const c = f.decks.configuration(f.actor); c.configurationRevision++; f.actor.setDynamicProperty(KEYS.configuration, JSON.stringify(c));
  f.fire(); assert.equal(f.target.damage.length, 0); invariant(f);
});
test('unexpected damage API failure is never retried and leaves a recovered hand', () => {
  const f = setup(); f.combat.applyDamage = () => { throw Error('engine failure'); };
  f.actions.useHand(f.actor, 0); const callback = f.fire(); callback(); assert.equal(f.battle().discardPile.length, 1); invariant(f);
});
test('legacy DeckManager still rejects asynchronous effect callbacks', () => {
  const f = setup(); assert.throws(() => f.decks.use(f.actor, 1, () => Promise.resolve()), /synchronous/); invariant(f);
});
test('accelerator nullifies a compatible GF attack and reflects through the GF path', () => {
  const f = setup(); defender(f); f.actions.useHand(f.actor, 1);
  assert.equal(f.target.damage.length, 0); assert.equal(f.actor.damage.length, 1);
  assert.ok(f.actor.damage[0].amount > 0); assert.equal(f.decks.load(f.target).battle.discardPile.length, 1); invariant(f); invariant(f, f.target);
});
test('incompatible yellow attack neither consumes nor triggers accelerator', () => {
  const f = setup(); defender(f); const before = f.target.getDynamicProperty(KEYS.battle);
  f.actions.useHand(f.actor, 0); f.fire(); assert.equal(f.target.damage[0].amount, 24); assert.equal(f.target.getDynamicProperty(KEYS.battle), before);
  assert.ok(f.target.getDynamicProperty(KEYS.manual)); assert.equal(f.actor.damage.length, 0);
});
test('reflect against reflect stops after one bounce while both defenses can fully block', () => {
  const f = setup(); defender(f); f.combat.armManual(f.actor, 2);
  f.actions.useHand(f.actor, 1); assert.equal(f.target.damage.length, 0); assert.equal(f.actor.damage.length, 0);
  assert.equal(f.battle().discardPile.length, 2); assert.equal(f.decks.load(f.target).battle.discardPile.length, 1);
  assert.equal(f.combat.reflections.length, 0); invariant(f); invariant(f, f.target);
});
test('multiple accelerator copies can be armed independently and replenish normally', () => {
  const f = setup(); defender(f, f.target, 3);
  for (let slot = 0; slot < 3; slot++) {
    f.combat.armManual(f.target, slot); f.combat.receive(f.target, { damage: 8, attributes: ['purple'] }, f.actor);
  }
  assert.equal(f.decks.load(f.target).battle.discardPile.length, 3); assert.equal(f.actor.damage.length, 3); invariant(f, f.target);
});
test('automatic-first reduction changes the reflected amount; manual-first stops later defenses', () => {
  for (const priority of ['automatic_first', 'manual_first']) {
    const f = setup(); defender(f); const c = f.decks.configuration(f.target);
    const attacker = f.decks.configuration(f.actor); attacker.autoDefense = [];
    f.actor.setDynamicProperty(KEYS.configuration, JSON.stringify(attacker));
    c.autoDefense = [{ copyId: 'guard', cardId: 'gf:colorless_guard' }]; c.settings.defensePriority = priority;
    f.actor.damage.length = 0; f.target.setDynamicProperty(KEYS.configuration, JSON.stringify(c));
    f.combat.receive(f.target, { damage: 8, attributes: ['purple'] }, f.actor);
    assert.equal(f.actor.damage[0].amount, priority === 'automatic_first' ? 4 : 8);
  }
});
test('manual-only accelerator is not accepted in automatic defense slots', () => {
  const f = setup(), c = structuredClone(f.config); c.autoDefense = [{ copyId: 'auto', cardId: 'gf:accelerator' }];
  assert.throws(() => f.decks.saveConfiguration(f.actor, c), /Manual defense/);
});
test('production cards preserve same-name limit, auto maximum nine, fixed capacity and dimension gate', () => {
  const f = setup(), c = structuredClone(f.config); c.randomDeck.slice(0, 4).forEach(copy => copy.cardId = 'gf:accelerator');
  assert.throws(() => f.decks.saveConfiguration(f.actor, c));
  const tooMany = structuredClone(f.config); tooMany.autoDefense = Array.from({ length: 10 }, (_, i) => ({ copyId: `auto${i}`, cardId: ['gf:red_shield', 'gf:blue_shield', 'gf:colorless_guard'][i % 3] }));
  assert.throws(() => f.decks.saveConfiguration(f.actor, tooMany));
  const fixed = structuredClone(f.config); fixed.fixedAttack.push({ copyId: 'f2', cardId: 'gf:black_flash_arrow' }); assert.throws(() => f.decks.saveConfiguration(f.actor, fixed));
  f.actor.dimension.id = 'minecraft:overworld'; for (const slot of [0, 1, 2]) assert.throws(() => f.actions.useHand(f.actor, slot));
  assert.equal(f.tasks.size, 0);
});
test('malformed effect and cooldown settings fail without overwriting stored data', () => {
  const f = setup(), railgun = f.registry.get('gf:railgun');
  assert.throws(() => new CardRegistry([{ ...railgun, effect: { type: 'railgun', parameters: { ...balance.railgun, maxTargets: 0 } } }]));
  f.actor.setDynamicProperty(COOLDOWN_KEY, 'broken'); assert.throws(() => f.actions.useHand(f.actor, 0));
  assert.equal(f.actor.getDynamicProperty(COOLDOWN_KEY), 'broken'); assert.equal(f.tasks.size, 0);
});

test('default null ammo mode does not read or alter the inventory', () => {
  const f = setup(); f.actor.getComponent = () => { throw Error('No inventory access in development mode'); };
  f.actions.useHand(f.actor, 0); f.fire(); assert.equal(f.target.damage.length, 1);
});
test('charge curve and penetration are configuration driven rather than fixed damage constants', () => {
  const f = setup({ baseDamage: 4, fullChargeDamage: 20, curveExponent: 2, penetrationMultiplier: .5 });
  const card = f.registry.get('gf:railgun');
  assert.equal(attackContext(card, f.actor, f.target, { charge: .5, targetIndex: 0 }).damage, 8);
  assert.equal(attackContext(card, f.actor, f.target, { charge: 1, targetIndex: 1 }).damage, 10);
});
test('charge reservation validates card identity and rejects arbitrary slot/mode requests', () => {
  const f = setup(), card = f.registry.get('gf:railgun');
  for (const [kind, slot] of [['hand', 1], ['fixed', 7], ['unknown', 0]]) assert.throws(() => f.activations.start(f.actor, kind, slot, card));
  assert.equal(f.tasks.size, 0); assert.equal(f.actor.getDynamicProperty(PENDING_KEY), undefined);
});
test('defense use during charge remains functional and invalidates the reserved attack safely', () => {
  const f = setup(), before = f.battle();
  const shield = f.decks.configuration(f.actor).randomDeck.find(c => c.cardId === 'gf:red_shield').copyId;
  const index = before.drawPile.indexOf(shield);
  [before.hand[3], before.drawPile[index]] = [before.drawPile[index], before.hand[3]];
  f.actor.setDynamicProperty(KEYS.battle, JSON.stringify(before)); f.combat.armManual(f.actor, 3);
  f.actions.useHand(f.actor, 0); f.combat.receive(f.actor, { damage: 10, attributes: ['red'] }, f.target);
  f.fire(); assert.equal(f.actor.damage.length, 0); assert.equal(f.target.damage.length, 0);
  assert.equal(f.battle().hand[0], before.hand[0]); assert.equal(f.battle().discardPile.length, 1); invariant(f);
});
test('automatic full nullification leaves accelerator armed and consumes no later manual card', () => {
  const f = setup(); defender(f); const c = f.decks.configuration(f.target);
  f.registry.cards.set('gf:purple_test_shield', { id: 'gf:purple_test_shield', name: 'Purple test', category: 'defense', activation: 'automatic', attributes: ['purple'], effect: { type: 'nullify' } });
  c.autoDefense = [{ copyId: 'purple_auto', cardId: 'gf:purple_test_shield' }]; c.settings.defensePriority = 'automatic_first';
  f.target.setDynamicProperty(KEYS.configuration, JSON.stringify(c)); const before = f.target.getDynamicProperty(KEYS.battle);
  const result = f.combat.receive(f.target, { damage: 10, attributes: ['purple'] }, f.actor);
  assert.deepEqual(result.applied, ['purple_auto']); assert.equal(f.target.getDynamicProperty(KEYS.battle), before);
  assert.ok(f.target.getDynamicProperty(KEYS.manual)); assert.equal(f.actor.damage.length, 0);
});
test('nine automatic defenses and three unlocked fixed attacks are still accepted', () => {
  const f = setup(), c = structuredClone(f.config); f.actor.setDynamicProperty(KEYS.fixedSlots, 3);
  c.fixedAttack = Array.from({ length: 3 }, (_, i) => ({ copyId: `fixed${i}`, cardId: 'gf:black_flash_arrow' }));
  c.autoDefense = Array.from({ length: 9 }, (_, i) => ({ copyId: `auto${i}`, cardId: ['gf:red_shield', 'gf:blue_shield', 'gf:colorless_guard'][i % 3] }));
  f.decks.saveConfiguration(f.actor, c); assert.equal(f.decks.configuration(f.actor).autoDefense.length, 9);
  f.actions.useFixed(f.actor, 2); invariant(f);
});
test('random case displays production summaries and routes railgun selection to pending status', async () => {
  const f = setup(), result = f.cases.showActiveAttack(f.actor);
  const labels = f.ui.shown[0].form.buttons.join('\n');
  for (const expected of ['超電磁砲', 'yellow', 'attack', '黒閃の矢', '2.5乗系']) assert.ok(labels.includes(expected));
  f.ui.respond({ selection: 0 }); await result;
  assert.ok(f.actor.messages.some(m => m.includes('チャージ中'))); assert.equal(f.target.damage.length, 0);
  f.fire(); assert.equal(f.target.damage.length, 1);
});
