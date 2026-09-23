import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { player, fixture as combatFixture } from './gf-fixture.mjs';
import { feedbackConfig, formatDamage, damageColour } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/config.js';
import { installCombatFeedback } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/CombatFeedback.js';
import { DamageTickets } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/feedback/DamageTickets.js';
import { CombatResolver } from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/combat/CombatResolver.js';
import { KEYS } from './gf-fixture.mjs';

function fixture() {
  let sequence = 0;
  const tasks = new Map(), handlers = {}, labels = [], hits = [];
  const system = { currentTick: 0,
    runTimeout(callback, delay) { tasks.set(++sequence, { callback, at: this.currentTick + delay }); return sequence; },
    runInterval() { throw Error('Global polling forbidden'); },
    clearRun(id) { tasks.delete(id); },
  };
  const signal = name => ({ subscribe(fn) { assert.equal(handlers[name], undefined); handlers[name] = fn; } });
  const world = { beforeEvents: { entityHurt: signal('before') }, afterEvents: { entityHurt: signal('after') } };
  const feedback = installCombatFeedback(world, system, 'magic', hit => hits.push(hit));
  const source = player('attacker');
  function target(id = 'victim', typeId = 'minecraft:zombie') {
    const value = player(id); value.typeId = typeId; value.nameTag = 'Original name'; value.getHeadLocation = () => ({ x: 1, y: 3, z: 5 });
    value.dimension.spawnEntity = (identifier, location) => { const label = { identifier, location, isValid: true, nameTag: '', remove() { this.isValid = false; } }; labels.push(label); return label; };
    return value;
  }
  function event(target, damage, attacker = source, cause = 'magic') { return { hurtEntity: target, damage, cancel: false, damageSource: { damagingEntity: attacker, cause } }; }
  function apply(target, actual, context = {}, { accepted = true, delayed = false, attacker = source } = {}) {
    let after;
    target.applyDamage = (planned, options) => {
      assert.equal(options.cause, 'magic');
      handlers.before(event(target, planned, attacker));
      after = event(target, actual, attacker);
      if (!delayed) handlers.after(after);
      return accepted;
    };
    feedback.apply(target, 999, attacker, { cardId: 'gf:black_flash_arrow', ...context });
    return () => handlers.after(after);
  }
  function advance(ticks) {
    const until = system.currentTick + ticks;
    while (true) {
      const next = [...tasks].filter(([, task]) => task.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) break;
      tasks.delete(next[0]); system.currentTick = next[1].at; next[1].callback();
    }
    system.currentTick = until;
  }
  return { system, world, handlers, feedback, source, target, event, apply, advance, tasks, labels, hits };
}

test('damage formatting uses at most two decimals without trailing zeroes', () => {
  assert.deepEqual([18.1, 24, 7.345, 0, .004].map(formatDamage), ['18.1', '24', '7.34', '0', '0']);
  for (const v of [-1, NaN, Infinity]) assert.throws(() => formatDamage(v));
});
test('damage colour thresholds are pure, independent and configurable', () => {
  assert.deepEqual([0, 3.99, 4, 9.99, 10, 19.99, 20, 49.99, 50, 99.99, 100].map(v => damageColour(v)), ['§c','§c','§6','§6','§e','§e','§a','§a','§b','§b','§d']);
  assert.equal(damageColour(1, [{ below: Infinity, code: 'custom' }]), 'custom');
});
test('only GF applyDamage tickets display actual engine damage, never the requested value', () => {
  const f = fixture(), target = f.target(); f.apply(target, 7.35);
  assert.equal(f.labels[0].nameTag, '§l§67.35'); assert.equal(f.hits[0].damage, 7.35); assert.equal(f.hits[0].ticket.cardId, 'gf:black_flash_arrow');
  assert.equal(f.hits[0].ticket.targetId, target.id); assert.equal(f.hits[0].ticket.sourceId, f.source.id);
});
test('ordinary melee, arrows and unrelated magic never display GF numbers', () => {
  const f = fixture(), target = f.target();
  for (const cause of ['entityAttack', 'projectile', 'magic']) { const e = f.event(target, 8, f.source, cause); f.handlers.before(e); f.handlers.after(e); }
  assert.equal(f.labels.length, 0); assert.equal(f.hits.length, 0);
});
test('accepted GF hits can deliver after applyDamage returns without borrowing a foreign magic event', () => {
  const f = fixture(), target = f.target();
  const foreign = f.event(target, 4); f.handlers.before(foreign);
  const finish = f.apply(target, 13.5, {}, { delayed: true });
  f.handlers.after(foreign); assert.equal(f.labels.length, 0); finish(); assert.equal(f.labels[0].nameTag, '§l§e13.5');
});
test('rejected/throwing applyDamage calls never leave a consumable ticket', () => {
  const f = fixture(), target = f.target(); const late = f.apply(target, 9, {}, { accepted: false, delayed: true }); late();
  assert.equal(f.labels.length, 0); assert.equal(f.feedback.tickets.size, 0);
  target.applyDamage = () => { f.handlers.before(f.event(target, 9)); throw Error('engine error'); };
  assert.throws(() => f.feedback.apply(target, 9, f.source, {}));
  assert.equal(f.feedback.tickets.size, 0); assert.equal(f.feedback.tickets.active.length, 0);
});
test('an unexpected unmatched after-event cannot consume a scoped ticket', () => {
  const f = fixture(), target = f.target();
  target.applyDamage = () => { f.handlers.after(f.event(target, 8)); return true; };
  f.feedback.apply(target, 8, f.source, {}); assert.equal(f.labels.length, 0); assert.equal(f.feedback.tickets.size, 0);
});
test('stale tickets expire with one bounded cleanup timeout and no global scan', () => {
  const f = fixture(); const finish = f.apply(f.target(), 20, {}, { delayed: true });
  assert.equal(f.tasks.size, 1); assert.equal(f.feedback.tickets.size, 1);
  f.advance(feedbackConfig.ticketTicks); finish(); assert.equal(f.labels.length, 0); assert.equal(f.feedback.tickets.size, 0); assert.equal(f.tasks.size, 0);
});
test('concurrent sources and targets are correlated independently even with reversed event delivery', () => {
  const f = fixture(), a = f.target('a'), b = f.target('b'), second = player('second');
  const finishA = f.apply(a, 18.1, { cardId: 'gf:black_flash_arrow' }, { delayed: true });
  const finishB = f.apply(b, 24, { cardId: 'gf:railgun' }, { delayed: true, attacker: second });
  finishB(); finishA(); assert.deepEqual(f.hits.map(h => [h.ticket.targetId, h.ticket.sourceId, h.damage]), [['b','second',24], ['a','attacker',18.1]]);
  assert.notEqual(f.hits[0].ticket.attackId, f.hits[1].ticket.attackId);
});
test('multiple hits on the same pair use one-shot FIFO tickets', () => {
  const f = fixture(), target = f.target(); const first = f.apply(target, 18, { cardId: 'one' }, { delayed: true });
  const second = f.apply(target, 13.5, { cardId: 'two' }, { delayed: true }); first(); second(); second();
  assert.deepEqual(f.hits.map(h => h.ticket.cardId), ['one','two']); assert.equal(f.labels.length, 2);
});
test('target names remain intact and labels become non-bold after five ticks', () => {
  const f = fixture(), target = f.target('named', 'minecraft:player'); f.apply(target, 18.1);
  assert.equal(target.nameTag, 'Original name'); assert.equal(f.labels[0].location.y, 3.35);
  f.advance(5); assert.equal(f.labels[0].nameTag, '§e18.1'); assert.equal(target.nameTag, 'Original name');
});
test('label definition owns 25-tick despawn, is transient, invulnerable and has no visible cubes or AI', () => {
  const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  const entity = read('behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/entities/gf_damage_number.entity.json')['minecraft:entity'];
  const c = entity.components;
  assert.equal(c['minecraft:timer'].time * 20, feedbackConfig.lifetimeTicks);
  assert.deepEqual(entity.events['gf:expire'].add.component_groups, ['gf:remove']); assert.ok(entity.component_groups['gf:remove']['minecraft:instant_despawn']);
  assert.ok(c['minecraft:transient']); assert.equal(c['minecraft:damage_sensor'].triggers[0].deals_damage, 'no');
  assert.equal(c['minecraft:nameable'].always_show, true); assert.equal(c['minecraft:physics'].has_collision, false);
  assert.equal(Object.keys(c).some(k => k.includes('behavior.') || k.includes('loot') || k.includes('persistent')), false);
  const geometry = read('resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/models/entity/gf_damage_number.geo.json');
  assert.equal(geometry['minecraft:geometry'][0].bones.some(b => b.cubes?.length), false);
});
test('railgun target damage labels remain independent after penetration calculation', () => {
  const f = fixture(); [24, 18, 13.5].forEach((damage, i) => f.apply(f.target(`rail${i}`), damage, { cardId: 'gf:railgun', effectType: 'railgun' }));
  assert.deepEqual(f.labels.map(l => l.nameTag), ['§l§a24','§l§e18','§l§e13.5']); assert.equal(f.hits.length, 3);
});
test('BLOCK does not call applyDamage or create a zero ticket', () => {
  const f = fixture(), c = combatFixture(), target = f.target();
  c.decks.saveConfiguration(target, { ...c.config, autoDefense: [{ copyId: 'shield', cardId: 'gf:red_shield' }] });
  const combat = new CombatResolver(c.decks, () => { throw Error('No damage call for nullify'); }, f.feedback);
  combat.receive(target, { damage: 10, attributes: ['red'] }, c.actor);
  assert.equal(f.labels[0].nameTag, '§l§bBLOCK'); assert.equal(f.feedback.tickets.size, 0); assert.equal(f.hits.length, 0);
});
test('reflection shows BLOCK on original target and engine-reported damage on original source', () => {
  const f = fixture(), c = combatFixture(), target = f.target('defender'), source = f.target('source', 'minecraft:player');
  const config = structuredClone(c.config); config.autoDefense = []; config.randomDeck[0].cardId = 'gf:accelerator';
  c.decks.saveConfiguration(target, config); const saved = c.decks.configuration(target);
  target.setDynamicProperty(KEYS.battle, JSON.stringify({ version:1, configurationRevision:saved.configurationRevision, hand:saved.randomDeck.slice(0,5).map(c=>c.copyId), drawPile:saved.randomDeck.slice(5).map(c=>c.copyId), discardPile:[], resolving:null }));
  const combat = new CombatResolver(c.decks, (t, damage, attacker, context) => {
    t.applyDamage = () => { f.handlers.before(f.event(t, damage, attacker)); f.handlers.after(f.event(t, 7.35, attacker)); return true; };
    return f.feedback.apply(t, damage, attacker, context);
  }, f.feedback);
  combat.armManual(target, 0); combat.receive(target, { damage:18.1, attributes:['purple'], cardId:'gf:black_flash_arrow' }, source);
  assert.deepEqual(f.labels.map(l=>l.nameTag), ['§l§bBLOCK','§l§67.35']); assert.equal(f.hits[0].ticket.reflected, true);
  assert.equal(f.hits[0].ticket.targetId, source.id);
});
test('target dummy keeps its own visual feedback but GF measurement still consumes its ticket', () => {
  const f = fixture(), target = f.target('dummy', 'dungeons:target_dummy'); f.apply(target, 24); f.feedback.block(target);
  assert.equal(f.labels.length, 0); assert.equal(f.hits.length, 1); assert.equal(f.feedback.tickets.size, 0); assert.equal(target.nameTag, 'Original name');
});
test('burst caps bound entities per target and globally without preventing measurement', () => {
  const f = fixture(), target = f.target(); for (let i=0;i<20;i++) f.apply(target, 10);
  assert.equal(f.labels.length, 3); assert.equal(f.hits.length, 20);
  for (let i=0;i<150;i++) f.apply(f.target(`target${i}`), 10);
  assert.equal(f.labels.length, feedbackConfig.globalLimit); f.advance(25);
  assert.equal(f.feedback.labels.count, 0); assert.equal(f.feedback.labels.targets.size, 0); assert.equal(f.tasks.size, 0);
});
test('ticket overload fails closed and cleans all bookkeeping without entity polling', () => {
  const f = fixture(), tickets = new DamageTickets(f.system, () => { throw Error('Must suppress'); }, 'magic', { ...feedbackConfig, maxRecords: 2 });
  for (let i=0;i<4;i++) tickets.before(f.event(f.target(`v${i}`), 8));
  assert.equal(tickets.size, 0); f.advance(2); assert.equal(f.tasks.size, 0);
});
test('feedback installation is idempotent and does not add HUD polling', () => {
  const f = fixture(); assert.equal(installCombatFeedback(f.world, f.system, 'magic'), f.feedback);
  assert.equal(f.tasks.size, 0); assert.deepEqual(Object.keys(f.handlers), ['before','after']);
});
test('fatal hits can display at the cached pre-hit head position without accessing removed targets later', () => {
  const f = fixture(), target = f.target('fatal');
  target.applyDamage = (_, options) => {
    f.handlers.before(f.event(target, 24)); target.isValid = false;
    f.handlers.after(f.event(target, 11)); return true;
  };
  f.feedback.apply(target, 24, f.source, { cardId: 'gf:railgun' });
  assert.equal(f.labels[0].nameTag, '§l§e11');
  Object.defineProperty(target, 'id', { get() { throw Error('removed'); } });
  f.advance(25); assert.equal(f.feedback.labels.count, 0);
});
test('cancelled foreign before-events do not shift a GF after-event into the wrong ticket', () => {
  const f = fixture(), target = f.target();
  const canceled = f.event(target, 8); f.handlers.before(canceled); canceled.cancel = true;
  const finish = f.apply(target, 13.5, {}, { delayed: true }); finish();
  assert.deepEqual(f.hits.map(h => h.damage), [13.5]);
});
