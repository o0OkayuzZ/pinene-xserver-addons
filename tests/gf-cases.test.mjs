import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fixture, KEYS, player, DIMENSION, DeckManager, FormSessions, CaseActions, CombatResolver } from './gf-fixture.mjs';
import { CASE_IDS, CASE_COMPONENT, giveCases } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cases/CaseItems.js';
import { beginUse } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/HandManager.js';
import { validateBattle } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/CardValidator.js';

const bp = '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/';
const rp = '../resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/';
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const state = f => f.decks.load(f.actor).battle;
const createItem = (typeId, amount) => ({ typeId, amount });
function invariant(f) {
  const battle = state(f);
  assert.ok(validateBattle(f.decks.configuration(f.actor), battle));
  assert.equal(battle.hand.length, 5);
  assert.equal(new Set([...battle.hand, ...battle.drawPile, ...battle.discardPile]).size, 16);
}

for (const [kind, id] of Object.entries(CASE_IDS)) test(`${kind} case definition is nonconsumable, stack 1, with a resolved shared atlas icon`, () => {
  const item = json(bp + `items/gf/cases/case_${kind}.json`)['minecraft:item'];
  assert.equal(item.description.identifier, id);
  assert.equal(item.components['minecraft:max_stack_size'], 1);
  assert.deepEqual(item.components[CASE_COMPONENT], {});
  const key = item.components['minecraft:icon'].textures.default;
  assert.equal(key, `pinene_gf_case_${kind}`);
  const texture = json(rp + 'textures/item_texture.json').texture_data[key].textures;
  assert.ok(existsSync(new URL(rp + texture + '.png', import.meta.url)));
  for (const component of ['minecraft:food', 'minecraft:throwable', 'minecraft:entity_placer', 'minecraft:block_placer', 'minecraft:durability']) assert.equal(item.components[component], undefined);
});

test('active attack filters five-slot hand and includes fixed attack, detail and pile counts', async () => {
  const f = fixture(), pending = f.cases.showActiveAttack(f.actor);
  const form = f.ui.shown[0].form;
  assert.equal(form.buttons.length, 4);
  assert.match(form.buttons[0], /Test Attack\nattack \| colorless/);
  assert.match(form.buttons[1], /手札 3: Blue Attack/);
  assert.match(form.buttons[2], /固定: Test Attack/);
  assert.equal(form.buttons[3], "攻撃カード詳細");
  assert.equal(state(f).hand.length, 5);
  assert.match(form.bodyText, /山札: 11枚 \/ 捨て札: 0枚/);
  assert.match(form.bodyText, /手動防御: なし/);
  f.ui.respond({ canceled: true }); await pending;
});
test('successful attack consumes only selected slot and replenishes one copy via existing combat', async () => {
  const f = fixture(), before = state(f);
  const pending = f.cases.showActiveAttack(f.actor); f.ui.respond({ selection: 0 }); await pending;
  const after = state(f);
  assert.equal(f.target.damage.length, 1); assert.equal(f.target.damage[0].amount, 10);
  assert.deepEqual(f.actor.lastRayOptions, { maxDistance: 24 });
  assert.deepEqual(after.hand.slice(1), before.hand.slice(1));
  assert.equal(after.hand[0], before.drawPile[0]); assert.equal(after.drawPile.length, 10);
  assert.deepEqual(after.discardPile, [before.hand[0]]); invariant(f);
});
test('target absence does not enter combat or mutate any player battle property', async () => {
  const f = fixture(); f.actor.targets = [];
  let called = 0; f.combat.useHand = () => { called++; };
  const before = [...f.actor.properties];
  const pending = f.cases.showActiveAttack(f.actor); f.ui.respond({ selection: 0 }); await pending;
  assert.equal(called, 0); assert.deepEqual([...f.actor.properties], before);
  assert.equal(f.actor.writes.length, 0); assert.match(f.actor.messages.at(-1), /対象がいません/);
});
test('manual defense arms in place without requiring any target', async () => {
  const f = fixture(); f.actor.targets = [];
  const before = f.actor.properties.get(KEYS.battle);
  const pending = f.cases.showActiveDefense(f.actor); f.ui.respond({ selection: 0 }); await pending;
  assert.equal(f.actor.properties.get(KEYS.battle), before);
  assert.equal(JSON.parse(f.actor.properties.get(KEYS.manual)).copyId, state(f).hand[1]);
  const next = f.cases.showActiveDefense(f.actor); assert.match(f.ui.shown.at(-1).form.bodyText, /Red Shield.*待機中/);
  f.ui.respond({ canceled: true }); await next;
});
test('incompatible attack retains manual defense; compatible attack consumes/replenishes it once', () => {
  const f = fixture(); f.actions.useHand(f.actor, 1);
  const before = f.actor.properties.get(KEYS.battle), armed = f.actor.properties.get(KEYS.manual);
  f.combat.receive(f.actor, { damage: 10, attributes: ['blue'] }, f.target);
  assert.equal(f.actor.properties.get(KEYS.battle), before); assert.equal(f.actor.properties.get(KEYS.manual), armed);
  const result = f.combat.receive(f.actor, { damage: 10, attributes: ['red'] }, f.target);
  assert.equal(result.damage, 0); assert.deepEqual(result.applied, [JSON.parse(armed).copyId]);
  assert.notEqual(f.actor.properties.get(KEYS.battle), before); assert.equal(f.actor.properties.has(KEYS.manual), false); invariant(f);
});

for (const change of ['hand', 'configurationRevision', 'dimension', 'leave-return', 'manual', 'fixedSlots', 'disconnect']) test(`stale ${change} rejects UI selection with no attack`, async () => {
  const f = fixture(), pending = f.cases.showActiveAttack(f.actor);
  if (change === 'hand') f.decks.use(f.actor, 4, () => {});
  if (change === 'configurationRevision') f.decks.saveConfiguration(f.actor, { ...f.config, settings: { defensePriority: 'automatic_first' } });
  if (change === 'dimension') f.actor.dimension.id = 'minecraft:overworld';
  if (change === 'leave-return') { f.sessions.invalidate(f.actor); f.sessions.invalidate(f.actor); }
  if (change === 'manual') f.combat.armManual(f.actor, 1);
  if (change === 'fixedSlots') f.actor.setDynamicProperty(KEYS.fixedSlots, 2);
  if (change === 'disconnect') f.actor.isValid = false;
  const before = [...f.actor.properties];
  f.ui.respond({ selection: 0 }); await pending;
  assert.equal(f.target.damage.length, 0); assert.deepEqual([...f.actor.properties], before);
  assert.match(f.actor.messages.at(-1), /開き直|ディメンション|退出/);
});

test('cancelled or invalid selections do not consume cards', async () => {
  const f = fixture(), before = [...f.actor.properties];
  for (const response of [{ canceled: true }, { selection: -1 }, { selection: 5 }, { selection: 0.5 }]) {
    const pending = f.cases.showActiveAttack(f.actor); f.ui.respond(response); await pending;
    assert.deepEqual([...f.actor.properties], before);
  }
});
test('outside dimension cases neither open combat UI nor rebuild saved battle', async () => {
  const f = fixture(); f.actor.dimension.id = 'minecraft:overworld';
  const before = [...f.actor.properties];
  await f.cases.showActiveAttack(f.actor); await f.cases.showActiveAttack(f.actor);
  assert.equal(f.ui.shown.length, 0); assert.deepEqual([...f.actor.properties], before);
  assert.equal(f.target.damage.length, 0);
});
test('unconfigured case cannot grant/edit cards or unlock slots', async () => {
  const f = fixture(), empty = player('empty'); await f.cases.showActiveAttack(empty); await f.cases.showActiveAttack(empty);
  assert.equal(empty.properties.size, 0); assert.equal(f.ui.shown.length, 0);
  assert.match(empty.messages[0], /未登録/);
});
test('auto defense case shows config order with attributes, effects and priority', async () => {
  const f = fixture(), before = [...f.actor.properties], pending = f.cases.showAutoDefense(f.actor), form = f.ui.shown[0].form;
  assert.equal(form.buttons.length, 1); assert.match(form.bodyText, /3 \/ 9枚/);
  assert.match(form.bodyText, /1\. Blue Shield\ndefense \| blue\nnullify/);
  assert.match(form.bodyText, /2\. Red Shield\ndefense \| red\nnullify/);
  assert.match(form.bodyText, /3\. Colorless Guard[\s\S]*reduce/);
  assert.match(form.bodyText, /manual_first/);
  f.ui.respond({ canceled: true }); await pending;
  assert.deepEqual([...f.actor.properties], before);
});

test('fixed attacks are repeatable and preserve every random battle byte', async () => {
  const f = fixture(), before = f.actor.properties.get(KEYS.battle);
  for (let i = 0; i < 3; i++) { const pending = f.cases.showActiveAttack(f.actor); f.ui.respond({ selection: 2 }); await pending; }
  assert.equal(f.target.damage.length, 3); assert.equal(f.actor.properties.get(KEYS.battle), before);
  assert.equal(f.actor.writes.length, 0);
});
test('fixed slots default to one, support three, and never exceed capacity', async () => {
  const f = fixture(), fixedAttack = [0, 1, 2].map(i => ({ copyId: `fixed_${i}`, cardId: 'gf:test_attack' }));
  assert.throws(() => f.decks.saveConfiguration(f.actor, { ...f.config, fixedAttack }));
  f.actor.setDynamicProperty(KEYS.fixedSlots, 3); f.decks.saveConfiguration(f.actor, { ...f.config, fixedAttack }); f.arrange();
  const pending = f.cases.showActiveAttack(f.actor); assert.equal(f.ui.shown[0].form.buttons.length, 6);
  f.ui.respond({ selection: 6 }); await pending; assert.equal(f.target.damage.length, 0);
  assert.throws(() => f.actions.useFixed(f.actor, 3), /枠/);
  f.actor.setDynamicProperty(KEYS.fixedSlots, 4); assert.throws(() => f.decks.load(f.actor), /capacity/);
});
test('fixed attack without target preserves battle and configuration', async () => {
  const f = fixture(); f.actor.targets = []; const before = [...f.actor.properties];
  const pending = f.cases.showActiveAttack(f.actor); f.ui.respond({ selection: 2 }); await pending;
  assert.deepEqual([...f.actor.properties], before); assert.match(f.actor.messages.at(-1), /対象がいません/);
});
test('fixed UI also rejects stale configuration and dimension round-trips', async () => {
  const f = fixture(), pending = f.cases.showActiveAttack(f.actor);
  f.sessions.invalidate(f.actor); f.ui.respond({ selection: 2 }); await pending;
  assert.equal(f.target.damage.length, 0);
});
test('case UI lock prevents simultaneous random/fixed forms and releases after close', async () => {
  const f = fixture(), pending = f.cases.showActiveAttack(f.actor); await f.cases.showActiveDefense(f.actor);
  assert.equal(f.ui.shown.length, 1); f.ui.respond({ canceled: true }); await pending;
  const next = f.cases.showActiveAttack(f.actor); assert.equal(f.ui.shown.length, 2); f.ui.respond({ canceled: true }); await next;
});
test('old disconnected form cannot unlock the new session form', () => {
  const sessions = new FormSessions(), p = player(); const old = sessions.begin(p);
  sessions.forget(p.id); const current = sessions.begin(p); sessions.end(p, old);
  assert.equal(sessions.begin(p), null); sessions.end(p, current); assert.ok(sessions.begin(p));
});

test('v1 configuration/BattleState survive relog and script-reload without shuffle or migration', () => {
  const f = fixture(); f.actions.useHand(f.actor, 0); const before = [...f.actor.properties];
  const relog = player(f.actor.id, DIMENSION, f.actor.properties);
  const fresh = new DeckManager(f.registry, undefined, () => { throw Error('normal restoration must not shuffle'); });
  const loaded = fresh.load(relog);
  assert.equal(loaded.config.version, 1); assert.equal(loaded.battle.version, 1);
  assert.deepEqual([...relog.properties], before); assert.equal(relog.writes.length, 0);
});
test('interrupted resolving persists outside dimension and completes once on re-entry without damage replay', () => {
  const f = fixture(), before = state(f), interrupted = beginUse(before, 0);
  f.actor.setDynamicProperty(KEYS.battle, JSON.stringify(interrupted)); f.actor.dimension.id = 'minecraft:overworld';
  const raw = f.actor.properties.get(KEYS.battle); assert.equal(f.decks.load(f.actor).active, false);
  assert.equal(f.actor.properties.get(KEYS.battle), raw);
  f.actor.dimension.id = DIMENSION;
  const fresh = new DeckManager(f.registry, undefined, () => 0.3), result = fresh.load(f.actor).battle;
  assert.equal(result.resolving, null); assert.ok(result.discardPile.includes(before.hand[0]));
  assert.equal(f.target.damage.length, 0); invariant(f);
});
test('corrupt configuration is preserved by both case UIs', async () => {
  const f = fixture(); f.actor.properties.set(KEYS.configuration, '{broken'); const before = [...f.actor.properties];
  await f.cases.showActiveAttack(f.actor); await f.cases.showActiveAttack(f.actor);
  assert.deepEqual([...f.actor.properties], before); assert.equal(f.ui.shown.length, 0);
});
test('200 hand uses and reshuffles retain sixteen unique copies and five hand slots', () => {
  const f = fixture(); for (let i = 0; i < 200; i++) { f.decks.use(f.actor, i % 5, () => {}); invariant(f); }
});
test('same configuration save is a no-op; max three cards per name remains enforced', () => {
  const f = fixture(); const before = [...f.actor.properties]; f.decks.saveConfiguration(f.actor, f.config);
  assert.deepEqual([...f.actor.properties], before);
  const randomDeck = structuredClone(f.config.randomDeck); randomDeck[3].cardId = 'gf:test_attack';
  assert.throws(() => f.decks.saveConfiguration(f.actor, { ...f.config, randomDeck }), /最大3/);
});
test('auto defense skips incompatible cards and stops at zero with automatic-first retaining manual', () => {
  const f = fixture(); f.decks.saveConfiguration(f.actor, { ...f.config, settings: { defensePriority: 'automatic_first' } }); f.arrange();
  f.actions.useHand(f.actor, 1); const before = f.actor.properties.get(KEYS.battle);
  const result = f.combat.receive(f.actor, { damage: 10, attributes: ['red'] }, f.target);
  assert.deepEqual(result.applied, ['auto_1']); assert.equal(result.damage, 0);
  assert.equal(f.actor.properties.get(KEYS.battle), before); assert.ok(f.actor.properties.has(KEYS.manual));
});
test('damage recursion is rejected without a second damage application', () => {
  const f = fixture(); let calls = 0;
  f.combat.applyDamage = (target, damage, source) => {
    calls++;
    assert.throws(() => f.combat.receive(target, { damage, attributes: ['red'] }, source), /recursion/);
  };
  f.actions.useHand(f.actor, 0); assert.equal(calls, 1); invariant(f);
});

test('give_cases grants one of each, repeats idempotently and ignores non-player sources', () => {
  const p = player(); giveCases(p, createItem); giveCases(p, createItem);
  assert.deepEqual(p.inventory.filter(Boolean).map(i => i.typeId), Object.values(CASE_IDS));
  assert.ok(p.inventory.filter(Boolean).every(i => i.amount === 1));
  assert.equal(giveCases({ typeId: 'minecraft:pig' }, () => { throw Error('not a player'); }), undefined);
});
for (const free of [0, 1, 2, 3]) test(`give_cases with only ${free} free slots makes no partial grant or overwrite`, () => {
  const p = player(); p.inventory.fill({ typeId: 'minecraft:diamond', amount: 64 });
  for (let i = 0; i < free; i++) p.inventory[i] = undefined;
  const before = structuredClone(p.inventory); const result = giveCases(p, createItem);
  assert.equal(result.full, true); assert.deepEqual(p.inventory, before);
});
test('give_cases fills only the missing case and does not duplicate a pre-owned case', () => {
  const p = player(); p.inventory.fill({ typeId: 'minecraft:stone', amount: 64 });
  p.inventory[0] = createItem(CASE_IDS.active_attack, 1); p.inventory[2] = createItem(CASE_IDS.active_defense, 1); p.inventory[3] = createItem(CASE_IDS.auto_attack, 1); p.inventory[1] = undefined;
  const result = giveCases(p, createItem); assert.deepEqual(result.added, [CASE_IDS.auto_defense]);
  assert.equal(p.inventory[0].typeId, CASE_IDS.active_attack); assert.equal(p.inventory[1].typeId, CASE_IDS.auto_defense);
});
test('give_cases retries a partial inventory write failure without duplicating the first item', () => {
  const p = player(), set = p.container.setItem; let calls = 0;
  p.container.setItem = (slot, item) => { if (++calls === 2) throw Error('inventory failure'); set(slot, item); };
  assert.throws(() => giveCases(p, createItem), /inventory failure/);
  p.container.setItem = set; giveCases(p, createItem);
  assert.deepEqual(p.inventory.filter(Boolean).map(i => i.typeId), Object.values(CASE_IDS));
});
test('give_cases creates all four item stacks before touching inventory', () => {
  const p = player(); let calls = 0;
  assert.throws(() => giveCases(p, (id, amount) => { if (++calls === 2) throw Error('unknown item'); return createItem(id, amount); }));
  assert.equal(p.inventory.filter(Boolean).length, 0);
});

const settle = () => new Promise(resolve => setImmediate(resolve));
test('filtered attack selection maps to original hand slot, preserving defense slots', async () => {
  const f = fixture(), before = state(f);
  const pending = f.cases.showActiveAttack(f.actor); f.ui.respond({ selection: 1 }); await pending;
  const after = state(f);
  assert.equal(after.hand[2], before.drawPile[0]);
  for (const slot of [0, 1, 3, 4]) assert.equal(after.hand[slot], before.hand[slot]);
  assert.deepEqual(after.discardPile, [before.hand[2]]); invariant(f);
});
test('active defense exposes only defense hand cards and maps its filtered slots', async () => {
  const f = fixture(), before = state(f), pending = f.cases.showActiveDefense(f.actor);
  const buttons = f.ui.shown[0].form.buttons;
  assert.equal(buttons.length, 3); assert.ok(buttons.every(b => b.includes('defense')));
  assert.match(buttons[1], /手札 4: Blue Shield/);
  f.ui.respond({ selection: 1 }); await pending;
  assert.equal(JSON.parse(f.actor.getDynamicProperty(KEYS.manual)).copyId, before.hand[3]);
  assert.deepEqual(state(f), before); assert.equal(f.target.damage.length, 0);
});
test('attack detail is read-only and preserves the form lock until closed', async () => {
  const f = fixture(), before = [...f.actor.properties], pending = f.cases.showActiveAttack(f.actor);
  f.ui.respond({ selection: 3 }); await settle();
  assert.equal(f.ui.shown[1].form.titleText, 'GF 攻撃カード詳細');
  f.ui.respond({ selection: 2 }); await settle();
  assert.match(f.ui.shown[2].form.bodyText, /固定: Test Attack/);
  await f.cases.showActiveDefense(f.actor); assert.equal(f.ui.shown.length, 3);
  f.ui.respond({ canceled: true }); await pending;
  assert.deepEqual([...f.actor.properties], before); assert.equal(f.target.damage.length, 0);
});
test('old Random/Fixed placeholder definitions are absent and all four textures remain 32px', () => {
  for (const kind of ['random', 'fixed']) assert.equal(existsSync(new URL(bp + `items/gf_${kind}_case.item.json`, import.meta.url)), false);
  assert.equal(Object.values(CASE_IDS).length, 4);
  for (const kind of Object.keys(CASE_IDS)) {
    const bytes = readFileSync(new URL(rp + `textures/items/gf/cases/case_${kind}.png`, import.meta.url));
    assert.equal(bytes.readUInt32BE(16), 32); assert.equal(bytes.readUInt32BE(20), 32);
  }
});
