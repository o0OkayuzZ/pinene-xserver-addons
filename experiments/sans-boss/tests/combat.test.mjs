import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = await readFile(new URL('../BP/scripts/combat.js', import.meta.url), 'utf8');
const rules = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('zero means guaranteed dodge, then monotonic fatigue reaches guaranteed hit', () => {
  assert.equal(rules.hitChance(0), 0);
  for (const roll of [0, 0.001, 0.5, 0.999999]) assert.equal(rules.shouldDodge(0, roll), true);
  assert.equal(rules.hitChance(1), 0.02);
  assert.equal(rules.hitChance(10), 0.2);
  assert.equal(rules.hitChance(25), 0.5);
  assert.equal(rules.hitChance(50), 1);
  assert.equal(rules.hitChance(1000), 1);
  for (let count = 1; count < 60; count++) assert.ok(rules.hitChance(count) >= rules.hitChance(count - 1));
  assert.equal(rules.shouldDodge(50, 0.999999), false);
  assert.equal(rules.hitChance(-2), 0);
});

test('bone collision includes swept motion and lets a player jump a low wall', () => {
  const prev = { x: 0, y: 1, z: -2 }, next = { x: 0, y: 1, z: 2 };
  assert.equal(rules.boneTouchesPlayer(prev, next, 1, { x: 0, y: 1, z: 0 }), true);
  assert.equal(rules.boneTouchesPlayer(prev, next, 1, { x: 0, y: 2.5, z: 0 }), false);
  assert.equal(rules.boneTouchesPlayer(prev, next, 2.6, { x: 0, y: 2.5, z: 0 }), true);
  assert.equal(rules.boneTouchesPlayer(prev, next, 2.6, { x: 1, y: 1, z: 0 }), false);
});

test('beam respects endpoints, height and crouched capsules', () => {
  const start = { x: 0, y: 1.8, z: 0 }, end = { x: 0, y: 1.8, z: 10 };
  assert.equal(rules.beamTouchesPlayer(start, end, { x: 0, y: 1, z: 5 }, 0.45), true);
  assert.equal(rules.beamTouchesPlayer(start, end, { x: 0, y: 1, z: 5 }, 0.45, 1.5), true);
  assert.equal(rules.beamTouchesPlayer(start, end, { x: 0, y: 1, z: 12 }, 0.45), false);
  assert.equal(rules.beamTouchesPlayer(start, end, { x: 2, y: 1, z: 5 }, 0.45), false);
});

test('twenty contact ticks drain ten HP; overlaps cap globally per tick', () => {
  let hp = 20;
  for (let tick = 0; tick < 20; tick++) hp = rules.healthAfterTick(hp, rules.CONFIG.boneDamagePerTick);
  assert.equal(hp, 10);
  assert.equal(rules.accumulatedDamage(0.75, 0.75), 1);
  assert.equal(rules.healthAfterTick(0.5, 1), 0);
});

function signal() {
  const callbacks = [];
  return { subscribe(fn) { callbacks.push(fn); }, emit(event) { for (const fn of callbacks) fn(event); } };
}

async function runtime({ warps = 0, teleportSucceeds = true } = {}) {
  const queued = [];
  const errors = [];
  const entities = new Map();
  let counter = 0;
  let restricted = false;
  let interval;
  let obstruction;
  function mutation() { assert.equal(restricted, false, 'mutation must not occur inside a before-event'); }
  const dimension = {
    id: 'minecraft:overworld',
    getPlayers(options) {
      return [...entities.values()].filter(entity => entity.typeId === 'minecraft:player' && entity.isValid
        && rules.distanceSquared(entity.location, options.location) <= options.maxDistance ** 2);
    },
    getEntities({ type }) { return [...entities.values()].filter(entity => entity.typeId === type && entity.isValid); },
    getBlock(location) {
      return { isAir: location.y >= 1, isLiquid: false,
        typeId: location.y >= 1 ? 'minecraft:air' : 'minecraft:stone',
        location: { x: Math.floor(location.x), y: Math.floor(location.y), z: Math.floor(location.z) } };
    },
    getBlockFromRay() { return obstruction; },
    spawnParticle() { mutation(); },
    playSound() { mutation(); },
    spawnEntity(type, pos) { mutation(); return makeEntity(type, pos); },
  };
  function makeEntity(type, position = { x: 0.5, y: 1, z: 0.5 }) {
    const dynamic = new Map(), properties = new Map();
    const health = {
      currentValue: type === 'minecraft:player' ? 20 : 1,
      setCurrentValue(value) { mutation(); this.currentValue = value; return true; },
    };
    const entity = {
      id: `entity-${++counter}`, typeId: type, isValid: true, dimension,
      location: { ...position }, isSneaking: false, mode: 'Survival',
      getComponent(id) { return id === 'minecraft:health' ? health : undefined; },
      getGameMode() { return this.mode; },
      getDynamicProperty(key) { return dynamic.get(key); },
      setDynamicProperty(key, value) { mutation(); dynamic.set(key, value); },
      setProperty(key, value) { mutation(); properties.set(key, value); },
      tryTeleport(pos) { mutation(); if (!teleportSucceeds) return false; this.location = { ...pos }; return true; },
      teleport(pos) { mutation(); this.location = { ...pos }; },
      remove() { mutation(); this.isValid = false; },
      applyDamage(amount, options) { mutation(); this.lastDamage = { amount, options }; health.currentValue = Math.max(0, health.currentValue - amount); return true; },
      get nameTag() { return this._nameTag; },
      set nameTag(value) { mutation(); this._nameTag = value; },
    };
    entities.set(entity.id, entity);
    return entity;
  }
  const world = {
    beforeEvents: { entityHurt: signal() },
    afterEvents: { entitySpawn: signal(), entityLoad: signal(), entityDie: signal(), playerLeave: signal() },
    getAllPlayers() { return [...entities.values()].filter(entity => entity.typeId === 'minecraft:player' && entity.isValid); },
  };
  const system = {
    run(fn) { queued.push(fn); },
    runInterval(fn) { interval = fn; },
  };
  const context = vm.createContext({
    console: { error(message) { errors.push(message); } },
    Math: Object.assign(Object.create(Math), { random: () => 0.5 }),
  });
  const server = new vm.SyntheticModule(['world', 'system', 'EntityDamageCause', 'MolangVariableMap'], function () {
    this.setExport('world', world); this.setExport('system', system);
    this.setExport('EntityDamageCause', { override: 'override' });
    this.setExport('MolangVariableMap', class {});
  }, { context });
  const combat = new vm.SourceTextModule(source, { context });
  const main = new vm.SourceTextModule(await readFile(new URL('../BP/scripts/main.js', import.meta.url), 'utf8'), { context });
  await main.link(specifier => specifier === '@minecraft/server' ? server : combat);
  await main.evaluate();
  const sans = makeEntity('pinene_sans:sans');
  sans.setDynamicProperty('pinene_sans:warps', warps);
  world.afterEvents.entitySpawn.emit({ entity: sans });
  const player = makeEntity('minecraft:player', { x: 0.5, y: 1, z: 6.5 });
  return {
    world, sans, player, entities, errors,
    attack(cause = 'entityAttack', amount = 100) {
      const event = { hurtEntity: sans, damage: amount,
        damageSource: { cause, damagingEntity: player }, cancel: false };
      restricted = true;
      try { world.beforeEvents.entityHurt.emit(event); } finally { restricted = false; }
      if (!event.cancel) sans.getComponent('minecraft:health').currentValue -= amount;
      return event;
    },
    step(count = 1) {
      for (let i = 0; i < count; i++) { interval(); while (queued.length) queued.shift()(); }
    },
    flush() { while (queued.length) queued.shift()(); },
    makeEntity,
    wallAt(z) { obstruction = { block: { location: { x: 0, y: 1, z } }, faceLocation: { x: 0.5, y: 0.5, z: 0 } }; },
  };
}

test('runtime cancels a lethal first hit without read-only mutations; successful dodge persists', async () => {
  const game = await runtime();
  assert.equal(game.attack().cancel, true);
  assert.equal(game.sans.getComponent('minecraft:health').currentValue, 1);
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 0);
  game.flush();
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 1);
  assert.match(game.sans.nameTag, /2%/);
});

test('failed dodge teleport never increases hit probability', async () => {
  const game = await runtime({ teleportSucceeds: false });
  assert.equal(game.attack('projectile').cancel, true);
  game.flush();
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 0);
});

test('multiple attacks in one tick do not count multiple phantom warps', async () => {
  const game = await runtime();
  for (let i = 0; i < 20; i++) assert.equal(game.attack().cancel, true);
  game.flush();
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 1);
});

test('fatigue restored on load permits actual damage at 100%; environment does not farm warps', async () => {
  const game = await runtime({ warps: 50 });
  assert.equal(game.attack('fireTick').cancel, true);
  game.flush();
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 50);
  assert.equal(game.attack().cancel, false);
  assert.ok(game.sans.getComponent('minecraft:health').currentValue <= 0);
});

test('administrative kill still works at zero fatigue', async () => {
  const game = await runtime();
  assert.equal(game.attack('selfDestruct').cancel, false);
});

test('automatic warps add fatigue only during an active encounter', async () => {
  const game = await runtime();
  game.player.mode = 'Creative';
  game.step(60);
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 0);
  game.player.mode = 'Survival';
  game.step(50);
  assert.equal(game.sans.getDynamicProperty('pinene_sans:warps'), 1);
});

test('bones warn before damage, then actual runtime drains health on consecutive ticks', async () => {
  const game = await runtime({ teleportSucceeds: false });
  game.step(30);
  const bones = [...game.entities.values()].filter(entity => entity.typeId === 'pinene_sans:bone');
  assert.equal(bones.length, 10);
  assert.equal(game.player.getComponent('minecraft:health').currentValue, 20);
  game.step(17);
  assert.equal(game.player.getComponent('minecraft:health').currentValue, 20);
  game.step();
  const contact = bones.find(entity => entity.isValid);
  const hp = game.player.getComponent('minecraft:health');
  game.player.location = { ...contact.location };
  game.step(2);
  assert.equal(hp.currentValue, 19);
});

test('blaster fires only after charge and stops after its finite firing window', async () => {
  const game = await runtime({ teleportSucceeds: false });
  game.step(95);
  const blaster = [...game.entities.values()].find(entity => entity.typeId === 'pinene_sans:blaster' && entity.isValid);
  assert.ok(blaster);
  // Move the player away from prior bones while staying in the warning beam.
  game.player.location = { x: 0.5, y: 1, z: 6.5 };
  const hp = game.player.getComponent('minecraft:health');
  hp.currentValue = 20;
  game.step(23);
  assert.equal(hp.currentValue, 20);
  game.step(2);
  assert.equal(hp.currentValue, 18.5);
  game.step(14);
  assert.equal(blaster.isValid, true);
  game.step();
  assert.equal(blaster.isValid, false);
});

test('boss death and no targets clean up every active hazard', async () => {
  const game = await runtime({ teleportSucceeds: false });
  game.step(30);
  assert.ok([...game.entities.values()].some(entity => entity.typeId === 'pinene_sans:bone' && entity.isValid));
  game.player.mode = 'Spectator';
  game.step();
  assert.equal([...game.entities.values()].filter(entity => /pinene_sans:(bone|blaster)/.test(entity.typeId) && entity.isValid).length, 0);
  game.player.mode = 'Survival';
  game.step(30);
  game.world.afterEvents.entityDie.emit({ deadEntity: game.sans });
  game.sans.isValid = false;
  assert.equal([...game.entities.values()].filter(entity => /pinene_sans:(bone|blaster)/.test(entity.typeId) && entity.isValid).length, 0);
});
