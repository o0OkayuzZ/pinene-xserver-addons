import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { installRuntime } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/Runtime.js';
import { CASE_COMPONENT, CASE_IDS } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/cases/CaseItems.js';
import { fixture, player, forms, DIMENSION, KEYS, DeckManager, FormSessions } from './gf-fixture.mjs';
import { beginUse } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/HandManager.js';

function environment(players = []) {
  const handlers = new Map(), jobs = [], components = new Map();
  let scans = 0, unavailable = false;
  const signals = (prefix, names) => Object.fromEntries(names.map(name => {
    const id = `${prefix}.${name}`, entries = []; handlers.set(id, entries);
    return [name, { subscribe(fn) { entries.push(fn); } }];
  }));
  const world = {
    beforeEvents: signals('before', ['entityHurt']),
    afterEvents: signals('world', ['worldLoad', 'playerSpawn', 'playerDimensionChange', 'playerLeave', 'entityHurt']),
    getAllPlayers() { scans++; if (unavailable) throw Error('early execution'); return players; },
  };
  const system = {
    beforeEvents: signals('system', ['startup']), afterEvents: signals('system', ['scriptEventReceive']),
    run(fn) { jobs.push(fn); },
    runInterval() { throw Error('GF must not poll'); },
  };
  return {
    world, system, handlers, jobs, components,
    get scans() { return scans; }, set unavailable(value) { unavailable = value; },
    emit(name, event = {}) { for (const fn of handlers.get(name)) fn(event); },
    startup() { this.emit('system.startup', { itemComponentRegistry: { registerCustomComponent(id, value) {
      assert.equal(components.has(id), false, 'duplicate custom component'); components.set(id, value);
    } } }); },
    flush() { while (jobs.length) jobs.shift()(); },
  };
}
function setup(f = fixture(), env = environment([f.actor])) {
  const warnings = [], menus = [];
  const args = { world: env.world, system: env.system, decks: f.decks, sessions: f.sessions,
    menu: p => { menus.push(p); }, cases: f.cases, createItem: (typeId, amount) => ({ typeId, amount }),
    log: { warn: value => warnings.push(value) } };
  const runtime = installRuntime(args);
  return { ...env, env, f, warnings, menus, args, runtime };
}
const settle = () => new Promise(resolve => setImmediate(resolve));

test('one online restore pass replaces all recurring 20-tick polling', () => {
  const f = fixture(), outside = player('outside', 'minecraft:overworld'), env = environment([f.actor, outside]);
  let loads = 0; const load = f.decks.load.bind(f.decks); f.decks.load = p => { loads++; return load(p); };
  setup(f, env); env.flush(); env.emit('world.worldLoad'); env.flush();
  assert.equal(env.scans, 1); assert.equal(loads, 1); assert.equal(env.jobs.length, 0);
  assert.equal(outside.writes.length, 0);
});
test('worldLoad wins the startup race without a second online scan', () => {
  const r = setup(); r.env.emit('world.worldLoad'); r.env.flush(); assert.equal(r.env.scans, 1);
});
test('early execution failure defers restore until worldLoad without any interval', () => {
  const f = fixture(), env = environment([f.actor]); env.unavailable = true;
  setup(f, env); env.flush(); env.unavailable = false; env.emit('world.worldLoad');
  assert.equal(env.scans, 2); assert.equal(env.jobs.length, 0); assert.equal(f.actor.writes.length, 0);
});
test('runtime install is idempotent and does not duplicate subscriptions/components', () => {
  const r = setup(); assert.equal(installRuntime(r.args), r.runtime);
  for (const [name, entries] of r.env.handlers) assert.equal(entries.length, name.endsWith('.entityHurt') ? 0 : 1);
  assert.equal(r.env.jobs.length, 1); r.env.startup(); assert.deepEqual([...r.env.components.keys()], [CASE_COMPONENT]);
});
test('case onUse opens once for duplicate input without changing stack or inventory', async () => {
  const r = setup(); r.env.startup(); r.env.flush();
  const stack = Object.freeze({ typeId: CASE_IDS.active_attack, amount: 1 });
  r.f.actor.inventory[0] = stack;
  const use = r.env.components.get(CASE_COMPONENT).onUse;
  use({ source: r.f.actor, itemStack: stack }); use({ source: r.f.actor, itemStack: stack });
  assert.equal(r.env.jobs.length, 1); r.env.flush(); assert.equal(r.f.ui.shown.length, 1);
  r.f.ui.respond({ selection: 0 }); await settle();
  assert.equal(stack.amount, 1); assert.equal(r.f.actor.inventory[0], stack); assert.equal(r.f.target.damage.length, 1);
});
test('auto defense case onUse routes to defense UI only and ignores other items/nonplayers', async () => {
  const r = setup(); r.env.startup(); r.env.flush(); const use = r.env.components.get(CASE_COMPONENT).onUse;
  use({ source: r.f.actor, itemStack: { typeId: 'minecraft:stick' } });
  use({ source: { typeId: 'minecraft:pig' }, itemStack: { typeId: CASE_IDS.auto_defense } });
  assert.equal(r.env.jobs.length, 0);
  use({ source: r.f.actor, itemStack: { typeId: CASE_IDS.auto_defense, amount: 1 } }); r.env.flush();
  assert.equal(r.f.ui.shown[0].form.titleText, 'GF 自動防御ケース'); r.f.ui.respond({ canceled: true }); await settle();
});
test('case onUse outside dimension performs no battle load or attack', async () => {
  const r = setup(); r.env.startup(); r.env.flush(); r.f.actor.dimension.id = 'minecraft:overworld';
  const before = [...r.f.actor.properties];
  r.env.components.get(CASE_COMPONENT).onUse({ source: r.f.actor, itemStack: { typeId: CASE_IDS.active_attack, amount: 1 } }); r.env.flush(); await settle();
  assert.equal(r.f.ui.shown.length, 0); assert.deepEqual([...r.f.actor.properties], before);
});
test('queued case operation is invalidated by dimension leave/reentry before it opens', () => {
  const r = setup(); r.env.startup(); r.env.flush();
  r.env.components.get(CASE_COMPONENT).onUse({ source: r.f.actor, itemStack: { typeId: CASE_IDS.active_attack } });
  r.env.emit('world.playerDimensionChange', { player: r.f.actor }); r.env.flush(); assert.equal(r.f.ui.shown.length, 0);
});
test('playerSpawn restores relog order and invalidates old UI identity', () => {
  const r = setup(); r.env.flush(); const before = [...r.f.actor.properties], identity = r.f.sessions.identity(r.f.actor);
  r.env.emit('world.playerSpawn', { player: r.f.actor }); assert.deepEqual([...r.f.actor.properties], before);
  assert.notEqual(r.f.sessions.identity(r.f.actor), identity);
});
test('dimension events preserve battle while outside and recover resolving on entry', () => {
  const r = setup(); r.env.flush(); const f = r.f;
  f.actor.setDynamicProperty(KEYS.battle, JSON.stringify(beginUse(f.decks.load(f.actor).battle, 0)));
  f.actor.dimension.id = 'minecraft:overworld'; const interrupted = f.actor.properties.get(KEYS.battle);
  r.env.emit('world.playerDimensionChange', { player: f.actor }); assert.equal(f.actor.properties.get(KEYS.battle), interrupted);
  f.actor.dimension.id = DIMENSION; r.env.emit('world.playerDimensionChange', { player: f.actor });
  assert.equal(f.decks.load(f.actor).battle.resolving, null); assert.equal(f.target.damage.length, 0);
});
test('script reload restores current online players without spawn or dimension events', () => {
  const f = fixture(); f.actor.setDynamicProperty(KEYS.battle, JSON.stringify(beginUse(f.decks.load(f.actor).battle, 0)));
  f.decks = new DeckManager(f.registry, undefined, () => 0.3); f.sessions = new FormSessions();
  const r = setup(f); r.env.flush();
  assert.equal(f.decks.load(f.actor).battle.resolving, null); assert.equal(r.env.scans, 1); assert.equal(f.target.damage.length, 0);
});
test('corrupt saved configuration logs once per session without overwrite', () => {
  const f = fixture(); f.actor.properties.set(KEYS.configuration, 'broken'); const before = [...f.actor.properties];
  const r = setup(f); r.env.flush(); r.env.emit('world.playerSpawn', { player: f.actor }); r.env.emit('world.playerDimensionChange', { player: f.actor });
  assert.equal(r.warnings.length, 1); assert.deepEqual([...f.actor.properties], before);
  r.env.emit('world.playerLeave', { playerId: f.actor.id }); r.env.emit('world.playerSpawn', { player: f.actor });
  assert.equal(r.warnings.length, 2);
});
test('debug menu and give_cases remain player-only script events', () => {
  const r = setup(); r.env.flush();
  for (const id of ['pinene_gf:menu', 'pinene_gf:give_cases']) r.env.emit('system.scriptEventReceive', { id, sourceEntity: { typeId: 'minecraft:pig' } });
  assert.equal(r.menus.length, 0); assert.equal(r.f.actor.inventory.filter(Boolean).length, 0);
  r.env.emit('system.scriptEventReceive', { id: 'pinene_gf:menu', sourceEntity: r.f.actor }); assert.equal(r.menus.length, 1);
  for (let i = 0; i < 2; i++) r.env.emit('system.scriptEventReceive', { id: 'pinene_gf:give_cases', sourceEntity: r.f.actor });
  assert.equal(r.f.actor.inventory.filter(Boolean).length, 4);
});

// Load the actual BP15 entry graph with only the two engine packages substituted.
async function entryGraph() {
  const actor = player(), env = environment([actor]), ui = forms();
  const context = vm.createContext({ console, Math, JSON, Set, Map, WeakMap });
  const server = new vm.SyntheticModule(['world', 'system', 'EntityDamageCause', 'ItemStack'], function () {
    this.setExport('world', env.world); this.setExport('system', env.system); this.setExport('EntityDamageCause', { magic: 'magic' });
    this.setExport('ItemStack', class { constructor(typeId, amount) { this.typeId = typeId; this.amount = amount; } });
  }, { context });
  const serverUi = new vm.SyntheticModule(['ActionFormData', 'ModalFormData'], function () {
    this.setExport('ActionFormData', ui.Form); this.setExport('ModalFormData', ui.Form);
  }, { context });
  const modules = new Map();
  function load(url) {
    if (!modules.has(url)) modules.set(url, new vm.SourceTextModule(readFileSync(new URL(url), 'utf8'), { context, identifier: url }));
    return modules.get(url);
  }
  const entry = load(new URL('../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/index.js', import.meta.url).href);
  await entry.link((specifier, parent) => {
    if (specifier === '@minecraft/server') return server;
    if (specifier === '@minecraft/server-ui') return serverUi;
    assert.ok(specifier.startsWith('.'), `Unexpected cross-pack/package import ${specifier}`);
    const url = new URL(specifier, parent.identifier).href;
    assert.ok(url.includes('/scripts/gf/'), 'GF must not import BP17 internals');
    return load(url);
  });
  await entry.evaluate(); env.startup(); env.flush();
  return { entry, actor, env, ui, modules };
}

test('actual GF entry graph installs once and debug editor now rejects unowned saves', async () => {
  const r = await entryGraph();
  for (const entries of r.env.handlers.values()) assert.equal(entries.length, 1);
  r.env.emit('system.scriptEventReceive', { id: 'pinene_gf:menu', sourceEntity: r.actor });
  assert.match(r.ui.shown[0].form.titleText, /開発用/);
  r.ui.respond({ selection: 0 }); await settle(); assert.equal(r.ui.shown[1].form.fields.length, 3);
  r.ui.respond({ formValues: ['1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6', '1', '5,4,6'] }); await settle();
  assert.equal(r.actor.properties.has(KEYS.configuration), false);
  assert.ok(r.actor.messages.length > 0);
  assert.equal(r.actor.properties.has(KEYS.fixedSlots), false);
});
test('actual index cases and debug UI share a lock, and reload/module cache does not resubscribe', async () => {
  const r = await entryGraph();
  const f = fixture(); r.actor.setDynamicProperty(KEYS.configuration, f.actor.getDynamicProperty(KEYS.configuration));
  r.env.components.get(CASE_COMPONENT).onUse({ source: r.actor, itemStack: { typeId: CASE_IDS.active_attack, amount: 1 } }); r.env.flush();
  r.env.emit('system.scriptEventReceive', { id: 'pinene_gf:menu', sourceEntity: r.actor }); assert.equal(r.ui.shown.length, 1);
  await r.entry.evaluate(); for (const entries of r.env.handlers.values()) assert.equal(entries.length, 1);
  r.ui.respond({ canceled: true }); await settle();
});
test('debug editor refuses a stale configuration revision without overwriting new data', async () => {
  const r = await entryGraph();
  r.env.emit('system.scriptEventReceive', { id: 'pinene_gf:menu', sourceEntity: r.actor });
  r.ui.respond({ selection: 0 }); await settle();
  const f = fixture(); r.actor.setDynamicProperty(KEYS.configuration, f.actor.getDynamicProperty(KEYS.configuration));
  const before = [...r.actor.properties];
  r.ui.respond({ formValues: ['1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6', '1', ''] }); await settle();
  assert.deepEqual([...r.actor.properties], before); assert.match(r.actor.messages.at(-1), /変化|更新/);
});

for (const [kind, id] of Object.entries(CASE_IDS)) test(`${kind} official case routes correctly and never consumes its stack`, async () => {
  const r = setup(); r.env.startup(); r.env.flush();
  const before = [...r.f.actor.properties], stack = Object.freeze({ typeId: id, amount: 1 });
  r.f.actor.inventory[0] = stack;
  r.env.components.get(CASE_COMPONENT).onUse({ source: r.f.actor, itemStack: stack }); r.env.flush();
  if (kind === 'auto_attack') {
    assert.equal(r.f.ui.shown.length, 0);
    assert.equal(r.f.actor.messages.at(-1), '自動攻撃システムは未実装です');
    assert.equal(r.env.jobs.length, 0);
  } else {
    const title = { active_attack: '能動攻撃', active_defense: '能動防御', auto_defense: '自動防御' }[kind];
    assert.equal(r.f.ui.shown[0].form.titleText, `GF ${title}ケース`);
    r.f.ui.respond({ canceled: true }); await settle();
  }
  assert.equal(r.f.actor.inventory[0], stack); assert.equal(stack.amount, 1);
  assert.deepEqual([...r.f.actor.properties], before); assert.equal(r.f.target.damage.length, 0);
});

test('reserved auto attack cannot restore corrupt battle data or start activations', async () => {
  const r = setup(); r.env.startup(); r.env.flush();
  r.f.actor.properties.set(KEYS.battle, 'broken');
  r.f.decks.load = () => { throw Error('reserved case must not load battle'); };
  const before = [...r.f.actor.properties];
  r.env.components.get(CASE_COMPONENT).onUse({ source: r.f.actor, itemStack: { typeId: CASE_IDS.auto_attack, amount: 1 } });
  r.env.flush(); await settle();
  assert.deepEqual([...r.f.actor.properties], before); assert.equal(r.env.jobs.length, 0);
  assert.equal(r.f.actor.messages.at(-1), '自動攻撃システムは未実装です');
});

test('legacy placeholder item IDs have no runtime entry', () => {
  const r = setup(); r.env.startup(); r.env.flush();
  for (const typeId of ['pinene:gf_random_case', 'pinene:gf_fixed_case']) {
    r.env.components.get(CASE_COMPONENT).onUse({ source: r.f.actor, itemStack: { typeId, amount: 1 } });
  }
  assert.equal(r.env.jobs.length, 0); assert.equal(r.f.ui.shown.length, 0);
});
