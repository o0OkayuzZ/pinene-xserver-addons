import { test } from 'node:test';
import assert from 'node:assert/strict';
import { player, forms, CardRegistry, DeckManager, FormSessions, KEYS } from './gf-fixture.mjs';
import { CardCollection, COLLECTION_KEY, deckUsage } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/collection/CardCollection.js';
import { DeckDraft } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/collection/DeckDraft.js';
import { createOwnershipApi } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/collection/OwnershipApi.js';
import { createCollectionMenu } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CollectionMenu.js';
import { createCaseMenu } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/ui/CaseMenu.js';
import { CaseActions, CombatResolver } from './gf-fixture.mjs';
import { installRuntime } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/Runtime.js';

function fixture() {
  // Additional definitions exist only in this test to exercise future complete owned decks.
  const definitions = Array.from({ length: 6 }, (_, i) => ({ id: `gf:future_${i}`, name: `Future ${i}`, developmentOnly: false,
    category: i === 0 ? 'defense' : 'attack', activation: i === 0 ? 'automatic' : 'manual', attributes: ['red'], effect: i === 0 ? { type: 'nullify' } : { type: 'damage', damage: 1 } }));
  const registry = new CardRegistry([...new CardRegistry().all(), ...definitions]);
  const actor = player(), collection = new CardCollection(registry), sessions = new FormSessions();
  const decks = new DeckManager(registry, undefined, () => .3, collection);
  const ids = ['gf:black_flash_arrow', ...definitions.map(d => d.id)];
  const config = { randomDeck: [ids[0], ...ids.slice(1, 6).flatMap(id => [id, id, id])].map((cardId, i) => ({ cardId, copyId: `r${i}` })), fixedAttack: [], autoDefense: [], settings: { defensePriority: 'manual_first' } };
  const grantAll = () => { for (const id of ids) collection.grant(actor, id, 3); };
  const ui = forms(), menu = createCollectionMenu(decks, collection, sessions, () => new ui.Form());
  return { registry, actor, collection, sessions, decks, config, ids, grantAll, ui, menu };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('collection load is read-only; production grants persist counts without copy identities', () => {
  const f = fixture(); assert.deepEqual(f.collection.load(f.actor), { version: 1, revision: 0, cards: {} }); assert.equal(f.actor.writes.length, 0);
  f.collection.grant(f.actor, 'gf:black_flash_arrow', 2); f.collection.grant(f.actor, 'gf:railgun', 1);
  const saved = JSON.parse(f.actor.getDynamicProperty(COLLECTION_KEY)); assert.equal(saved.revision, 2);
  assert.deepEqual(saved.cards, { 'gf:black_flash_arrow': 2, 'gf:railgun': 1 }); assert.equal(JSON.stringify(saved).includes('copyId'), false);
  assert.equal(new CardCollection(f.registry).count(f.actor, 'gf:black_flash_arrow'), 2);
});
test('unknown and development-only cards cannot be granted or revoked normally', () => {
  const f = fixture();
  for (const id of ['gf:missing', 'gf:test_attack', 'gf:red_shield']) {
    assert.throws(() => f.collection.grant(f.actor, id, 1)); assert.throws(() => f.collection.revoke(f.actor, id, 1));
  }
  assert.equal(f.actor.writes.length, 0); assert.equal(f.registry.get('gf:test_attack').developmentOnly, true);
  assert.equal(f.registry.get('gf:railgun').developmentOnly, false);
});
test('invalid amounts and numeric/revision overflow never mutate collection', () => {
  const f = fixture();
  for (const amount of [-1, 0, NaN, Infinity, .5, Number.MAX_SAFE_INTEGER + 1, '1']) assert.throws(() => f.collection.grant(f.actor, 'gf:railgun', amount));
  f.collection.grant(f.actor, 'gf:railgun', Number.MAX_SAFE_INTEGER); const before = f.actor.getDynamicProperty(COLLECTION_KEY);
  assert.throws(() => f.collection.grant(f.actor, 'gf:railgun', 1)); assert.equal(f.actor.getDynamicProperty(COLLECTION_KEY), before);
  f.actor.setDynamicProperty(COLLECTION_KEY, JSON.stringify({ version: 1, revision: Number.MAX_SAFE_INTEGER, cards: {} }));
  assert.throws(() => f.collection.grant(f.actor, 'gf:railgun', 1));
});
test('corrupted collection remains byte-identical and does not silently initialize', () => {
  const f = fixture();
  for (const raw of ['broken', 'null', '{"version":1,"revision":1,"cards":{"gf:railgun":0}}', '{"version":1,"revision":1,"cards":{"unknown":1}}']) {
    f.actor.setDynamicProperty(COLLECTION_KEY, raw);
    assert.throws(() => f.collection.load(f.actor)); assert.throws(() => f.collection.grant(f.actor, 'gf:railgun', 1));
    assert.equal(f.actor.getDynamicProperty(COLLECTION_KEY), raw);
  }
});
test('failed property writes do not mutate cached/loaded collection or emit acquisition notices', () => {
  const f = fixture(); f.collection.grant(f.actor, 'gf:railgun', 2); const before = f.actor.getDynamicProperty(COLLECTION_KEY);
  f.actor.setDynamicProperty = () => { throw Error('save failed'); };
  const api = createOwnershipApi(f.collection, { warn() {} });
  assert.throws(() => api.grantCard(f.actor, 'gf:railgun', 1)); assert.throws(() => f.collection.revoke(f.actor, 'gf:railgun', 1));
  assert.equal(f.actor.getDynamicProperty(COLLECTION_KEY), before); assert.equal(f.actor.messages.length, 0);
});
test('grant API notifies only after a successful save and source is only log metadata', () => {
  const f = fixture(), logs = [], api = createOwnershipApi(f.collection, { warn: m => logs.push(m) });
  api.grantCard(f.actor, 'gf:railgun', 1, { source: 'dungeon/test' });
  assert.equal(f.collection.count(f.actor, 'gf:railgun'), 1); assert.match(f.actor.messages[0], /超電磁砲/); assert.match(logs[0], /dungeon\/test/);
  f.actor.sendMessage = () => { throw Error('disconnected UI'); };
  api.grantCard(f.actor, 'gf:railgun', 1); assert.equal(f.collection.count(f.actor, 'gf:railgun'), 2);
});
test('owned one permits one copy and rejects two copies on configuration save', () => {
  const f = fixture(); f.grantAll(); f.collection.revoke(f.actor, f.ids[0], 2);
  f.decks.saveConfiguration(f.actor, f.config); const before = f.actor.getDynamicProperty(KEYS.configuration);
  const more = structuredClone(f.config); more.randomDeck[1].cardId = f.ids[0];
  assert.throws(() => f.decks.saveConfiguration(f.actor, more)); assert.equal(f.actor.getDynamicProperty(KEYS.configuration), before);
});
test('random plus fixed and random plus automatic share the same owned copy budget', () => {
  const f = fixture(); f.grantAll(); f.collection.revoke(f.actor, f.ids[0], 2);
  const fixed = structuredClone(f.config); fixed.fixedAttack = [{ copyId: 'fixed', cardId: f.ids[0] }];
  assert.throws(() => f.decks.saveConfiguration(f.actor, fixed));
  const automatic = structuredClone(f.config); automatic.autoDefense = [{ copyId: 'auto', cardId: f.ids[1] }];
  assert.throws(() => f.decks.saveConfiguration(f.actor, automatic));
});
test('same-name cap is global across groups even with surplus ownership', () => {
  const f = fixture(); f.grantAll(); f.collection.grant(f.actor, f.ids[2], 5);
  f.config.fixedAttack = [{ copyId: 'extra', cardId: f.ids[2] }];
  assert.throws(() => f.decks.saveConfiguration(f.actor, f.config), /最大3枚/);
});
test('different card ownership is independent and used/available counts combine all groups', () => {
  const f = fixture(); f.grantAll(); f.config.fixedAttack = [{ copyId: 'fixed', cardId: f.ids[0] }]; f.decks.saveConfiguration(f.actor, f.config);
  assert.equal(f.collection.availableForDeck(f.actor, f.ids[0]), 1); assert.equal(f.collection.availableForDeck(f.actor, f.ids[1]), 0);
  assert.equal(f.collection.has(f.actor, f.ids[0], 3), true); assert.equal(f.collection.has(f.actor, 'gf:railgun', 1), false);
});
test('legacy configuration and BattleState work without collection and are never migrated automatically', () => {
  const f = fixture(); f.actor.setDynamicProperty(KEYS.configuration, JSON.stringify({ ...f.config, version: 1, configurationRevision: 1 }));
  const state = f.decks.load(f.actor).battle; const before = f.actor.getDynamicProperty(KEYS.configuration);
  assert.equal(f.actor.getDynamicProperty(COLLECTION_KEY), undefined);
  f.decks.use(f.actor, 0, () => {}); assert.equal(f.decks.load(f.actor).battle.version, 1);
  assert.equal(f.actor.getDynamicProperty(KEYS.configuration), before); assert.equal(state.hand.length, 5);
  assert.throws(() => f.decks.saveConfiguration(f.actor, f.config));
});
test('creating or corrupting a collection does not invalidate the existing legacy loadout', () => {
  const f = fixture(); f.actor.setDynamicProperty(KEYS.configuration, JSON.stringify({ ...f.config, version: 1, configurationRevision: 1 }));
  const before = f.decks.load(f.actor).battle;
  f.collection.grant(f.actor, 'gf:railgun', 1); assert.deepEqual(f.decks.load(f.actor).battle, before);
  f.actor.setDynamicProperty(COLLECTION_KEY, 'broken'); assert.deepEqual(f.decks.load(f.actor).battle, before);
  assert.throws(() => f.decks.saveConfiguration(f.actor, f.config));
});
test('unused revoke succeeds; used copies cannot be revoked and configuration remains untouched', () => {
  const f = fixture(); f.grantAll(); f.decks.saveConfiguration(f.actor, f.config);
  f.collection.revoke(f.actor, f.ids[0], 2); assert.equal(f.collection.count(f.actor, f.ids[0]), 1);
  const before = [...f.actor.properties]; assert.throws(() => f.collection.revoke(f.actor, f.ids[0], 1)); assert.deepEqual([...f.actor.properties], before);
  assert.throws(() => f.collection.revoke(f.actor, 'gf:railgun', 1));
});
test('draft can be incomplete without replacing valid configuration; save requires exactly sixteen', () => {
  const f = fixture(); f.grantAll(); f.decks.saveConfiguration(f.actor, f.config);
  const before = f.actor.getDynamicProperty(KEYS.configuration), draft = new DeckDraft(f.actor, f.decks, f.collection, f.sessions);
  draft.remove('randomDeck', 0); assert.equal(draft.value.randomDeck.length, 15); assert.throws(() => draft.save());
  assert.equal(f.actor.getDynamicProperty(KEYS.configuration), before); draft.add('randomDeck', f.ids[0]); draft.save();
  assert.equal(f.decks.configuration(f.actor).randomDeck.length, 16);
});
test('draft stale collection/configuration/capacity/session revisions cannot save', () => {
  for (const mutate of [f => f.collection.grant(f.actor, 'gf:railgun', 1), f => f.actor.setDynamicProperty(KEYS.fixedSlots, 2), f => f.sessions.invalidate(f.actor), f => f.actor.setDynamicProperty(KEYS.configuration, 'changed')]) {
    const f = fixture(); f.grantAll(); const draft = new DeckDraft(f.actor, f.decks, f.collection, f.sessions); mutate(f);
    assert.throws(() => draft.save());
  }
});
test('draft checks owned counts, name cap, categories, manual defense and unlocked fixed slots', () => {
  const f = fixture(); f.grantAll(); const draft = new DeckDraft(f.actor, f.decks, f.collection, f.sessions);
  draft.add('fixedAttack', f.ids[0]); assert.throws(() => draft.add('fixedAttack', f.ids[0]));
  assert.throws(() => draft.add('randomDeck', 'gf:railgun')); assert.throws(() => draft.add('randomDeck', 'gf:test_attack'));
  assert.throws(() => draft.add('autoDefense', f.ids[0]));
  f.collection.grant(f.actor, 'gf:accelerator', 1);
  const second = new DeckDraft(f.actor, f.decks, f.collection, f.sessions); assert.throws(() => second.add('autoDefense', 'gf:accelerator'));
});
test('draft preserves automatic defense order and generates unique deck-only copyIds', () => {
  const f = fixture(); f.grantAll(); const draft = new DeckDraft(f.actor, f.decks, f.collection, f.sessions);
  draft.add('autoDefense', f.ids[1]); draft.add('autoDefense', f.ids[1]); const first = draft.value.autoDefense[0].copyId;
  draft.moveUp('autoDefense', 1); assert.equal(draft.value.autoDefense[1].copyId, first);
  assert.equal(new Set(draft.value.autoDefense.map(c => c.copyId)).size, 2);
  assert.equal(JSON.stringify(f.collection.load(f.actor)).includes('copyId'), false);
});
test('collection UI shows production names and correct owned/used/available but hides development cards', async () => {
  const f = fixture(); f.grantAll(); f.decks.saveConfiguration(f.actor, f.config);
  const shown = f.menu.showCollection(f.actor), body = f.ui.shown[0].form.bodyText;
  assert.match(body, /黒閃の矢/); assert.match(body, /所有3 \/ 使用1 \/ 残り2/); assert.match(body, /未入手/); assert.doesNotMatch(body, /Test Attack|Red Shield/);
  f.ui.respond({ selection: 0 }); await shown;
});
test('case exposes collection and draft entry points without a deck and outside the combat dimension', async () => {
  const f = fixture(); f.actor.dimension.id = 'minecraft:overworld';
  const actions = new CaseActions(f.decks, new CombatResolver(f.decks, () => {}), f.sessions);
  const cases = createCaseMenu(f.decks, actions, f.sessions, () => new f.ui.Form(), f.menu);
  const shown = cases.showActiveAttack(f.actor); assert.deepEqual(f.ui.shown[0].form.buttons, ['カードコレクション', 'デッキ構築']);
  f.ui.respond({ selection: 0 }); await settle(); assert.match(f.ui.shown[1].form.titleText, /コレクション/);
  f.ui.respond({ canceled: true }); await shown; assert.equal(f.actor.getDynamicProperty(KEYS.battle), undefined);
});
test('builder UI refuses an incomplete save and discard leaves persistent configuration unchanged', async () => {
  const f = fixture(); const shown = f.menu.showBuilder(f.actor);
  f.ui.respond({ selection: 3 }); await settle(); assert.ok(f.actor.messages.some(m => m.includes('保存できません')));
  f.ui.respond({ selection: 4 }); await shown; assert.equal(f.actor.getDynamicProperty(KEYS.configuration), undefined);
});
test('debug grant routes production IDs, rejects malformed/test grants and ignores nonplayer sources', () => {
  const f = fixture(), callbacks = {}, signal = name => ({ subscribe(fn) { callbacks[name] = fn; } });
  const world = { getAllPlayers: () => [], afterEvents: Object.fromEntries(['worldLoad', 'playerSpawn', 'playerDimensionChange', 'playerLeave'].map(n => [n, signal(n)])) };
  const system = { run() {}, beforeEvents: { startup: signal('startup') }, afterEvents: { scriptEventReceive: signal('command') } };
  const api = createOwnershipApi(f.collection, { warn() {} });
  installRuntime({ world, system, decks: f.decks, sessions: f.sessions, menu() {}, cases: {}, createItem() {}, grantCard: api.grantCard });
  for (const message of ['railgun 1', 'gf:black_flash_arrow 2', 'test_attack 1', 'railgun -1', 'railgun 0', 'railgun 1 extra']) callbacks.command({ id: 'pinene_gf:grant', message, sourceEntity: f.actor });
  callbacks.command({ id: 'pinene_gf:grant', message: 'railgun 1' });
  assert.equal(f.collection.count(f.actor, 'gf:railgun'), 1); assert.equal(f.collection.count(f.actor, 'gf:black_flash_arrow'), 2);
  assert.equal(f.collection.count(f.actor, 'gf:test_attack'), 0);
});

for (const method of ['showActiveAttack', 'showActiveDefense', 'showAutoDefense']) test(`${method} opens ownership-validating deck builder without granting or migrating cards`, async () => {
  const f = fixture(), before = [...f.actor.properties];
  const actions = new CaseActions(f.decks, new CombatResolver(f.decks, () => {}), f.sessions);
  const cases = createCaseMenu(f.decks, actions, f.sessions, () => new f.ui.Form(), f.menu);
  const pending = cases[method](f.actor);
  f.ui.respond({ selection: 1 }); await settle();
  assert.equal(f.ui.shown[1].form.titleText, 'GF デッキ構築');
  f.ui.respond({ selection: 3 }); await settle();
  assert.ok(f.actor.messages.some(m => m.includes('保存できません')));
  f.ui.respond({ selection: 4 }); await pending;
  assert.deepEqual([...f.actor.properties], before);
});
