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

async function runtime({ warps = 0, teleportSucceeds = true, bones = true } = {}) {
  const queued = [];
  const soundEvents = [];
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
    getBlockFromRay(origin, direction, options = {}) {
      if (direction.y === -1) {
        if (!bones && options.maxDistance === 8) return undefined;
        const location={x:Math.floor(origin.x),y:0,z:Math.floor(origin.z)};
        return {block:{location},faceLocation:{x:origin.x-location.x,y:1,z:origin.z-location.z}};
      }
      if (!obstruction) return undefined;
      const point = rules.add(origin, rules.scale(direction, 2));
      const location = {x:Math.floor(point.x), y:Math.floor(point.y), z:Math.floor(point.z)};
      return {block:{location}, faceLocation:rules.subtract(point,location)};
    },
    spawnParticle() { mutation(); },
    playSound(id) { mutation(); soundEvents.push(id); },
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
      location: { ...position }, isSneaking: false, isOnGround:false, impulses:[], mode: 'Survival',
      clearVelocity() { mutation(); },
      applyImpulse(value) { mutation(); this.impulses.push({...value}); },
      getComponent(id) { return id === 'minecraft:health' ? health : undefined; },
      getGameMode() { return this.mode; },
      getDynamicProperty(key) { return dynamic.get(key); },
      setDynamicProperty(key, value) { mutation(); dynamic.set(key, value); },
      setProperty(key, value) { mutation(); properties.set(key, value); },
      getProperty(key) { return properties.get(key); },
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
    world, sans, player, entities, errors, soundEvents,
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

test('spikes warn, thrust on their axis and drain health on consecutive ticks', async () => {
 const game=await runtime({teleportSucceeds:false});game.step(30);
 const bones=[...game.entities.values()].filter(e=>e.typeId==='pinene_sans:bone');
 assert.equal(bones.length,1);const hp=game.player.getComponent('minecraft:health');
 game.step(9);assert.equal(hp.currentValue,20);
 game.step(4);
 const first=bones[0];
 game.player.location={...first.location,y:1};hp.currentValue=20;
 game.step();assert.equal(hp.currentValue,19.5);
 game.step();assert.equal(hp.currentValue,19);
});

test('blaster fires only after charge and stops after its finite firing window', async () => {
  const game = await runtime({ teleportSucceeds: false, bones:false });
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
  assert.equal(blaster.isValid, true);
  assert.equal(blaster.getProperty('pinene_sans:firing'), false);
  game.step(rules.CONFIG.blasterDepartureTicks);
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

test('runtime raycast obstruction shields a player from the blaster', async () => {
  const game = await runtime({ teleportSucceeds: false, bones:false });
  game.wallAt(0);
  game.step(95);
  game.player.location = { x: 0.5, y: 1, z: 6.5 };
  const hp = game.player.getComponent('minecraft:health');
  hp.currentValue = 20;
  game.step(40);
  assert.equal(hp.currentValue, 20);
});

test('casting eye follows actual hazards and resets when a target leaves', async () => {
  const game = await runtime({ teleportSucceeds: false });
  assert.equal(game.sans.getProperty('pinene_sans:casting'), false);
  game.step(30);
  assert.equal(game.sans.getProperty('pinene_sans:casting'), true);
  game.player.mode = 'Spectator';
  game.step();
  assert.equal(game.sans.getProperty('pinene_sans:casting'), false);
});

test('karma is capped and cannot cross the one HP floor', () => {
  assert.equal(rules.addKarmaDebt(5.9, 1, 20), 6);
  assert.equal(rules.addKarmaDebt(5, 1, 2), 1);
  assert.equal(rules.karmaPulse(5, 1), 0);
  assert.equal(rules.karmaPulse(5, 20, 0), 0);
  assert.equal(rules.karmaPulse(5, 20, 0.1), 0.1);
  assert.ok(Math.abs(rules.karmaPulse(1, 1.1)-0.1)<1e-10);
});

test('karma persists after escaping a beam, then drains every four ticks', async () => {
  const game = await runtime({ teleportSucceeds: false, bones:false });
  game.step(134);
  const hp = game.player.getComponent('minecraft:health');
  assert.equal(hp.currentValue, 5);
  game.player.location.x += 10;
  game.player.location.z += 10;
  game.step(9);
  assert.equal(hp.currentValue, 5);
  game.step();
  assert.equal(hp.currentValue, 4.75);
  game.step(3);
  assert.equal(hp.currentValue, 4.75);
  game.step();
  assert.equal(hp.currentValue, 4.5);
});

test('karma stops at one HP and clears for creative players and defeated bosses', async () => {
  const game = await runtime({ teleportSucceeds: false, bones:false });
  game.step(134);
  game.player.location.x += 10;
  game.player.location.z += 10;
  const hp = game.player.getComponent('minecraft:health');
  hp.currentValue = 1.05;
  game.step(20);
  assert.equal(hp.currentValue, 1);
  assert.equal(game.player.lastDamage, undefined);
  const creative = await runtime({ teleportSucceeds: false, bones:false });
  creative.step(134);
  creative.player.mode = 'Creative';
  creative.step(20);
  assert.equal(creative.player.getComponent('minecraft:health').currentValue, 5);
  const victory = await runtime({ teleportSucceeds: false, bones:false });
  victory.step(134);
  victory.world.afterEvents.entityDie.emit({ deadEntity: victory.sans });
  victory.sans.isValid = false;
  victory.step(20);
  assert.equal(victory.player.getComponent('minecraft:health').currentValue, 5);
});

test('hovering settles at aim lock; black ray becomes a solid firing beam and cleans up', async () => {
  const game = await runtime({ teleportSucceeds: false, bones:false });
  game.step(95);
  const head = [...game.entities.values()].find(e => e.typeId === 'pinene_sans:blaster' && e.isValid);
  const ray = [...game.entities.values()].find(e => e.typeId === 'pinene_sans:ray' && e.isValid);
  assert.ok(head && ray);
  assert.equal(ray.getProperty('pinene_sans:firing'), false);
  assert.equal(ray.getProperty('pinene_sans:width'), 0.025);
  assert.equal(head.getProperty('pinene_sans:arrival') ?? 0, 0);
  const startY = head.location.y;
  game.step(6);
  assert.notEqual(head.location.y, startY);
  assert.equal(head.getProperty('pinene_sans:arrival'), 0.6);
  game.step(10);
  assert.equal(head.getProperty('pinene_sans:arrival'), 1);
  const lockLocation = { ...head.location };
  game.step(8);
  assert.deepEqual(head.location, lockLocation);
  assert.equal(ray.getProperty('pinene_sans:firing'), true);
  assert.equal(ray.getProperty('pinene_sans:width'), 1.05);
  assert.equal(head.getProperty('pinene_sans:recoil'), 1);
  game.step(12);
  assert.equal(ray.getProperty('pinene_sans:width'), rules.blastWidth(12));
  assert.ok(ray.getProperty('pinene_sans:width') < 0.5);
  game.step(4);
  assert.equal(head.isValid, true);
  assert.equal(ray.isValid, false);
  assert.ok(head.getProperty('pinene_sans:departure') > 0);
  game.step(rules.CONFIG.blasterDepartureTicks);
  assert.equal(head.isValid, false);
});


test('ring slots alternate opposite sides with a four-tick cadence and six-head cap', () => {
  const slots=rules.blasterRingPlan({x:0,y:0,z:0},0,6);
  assert.equal(slots.length,6);
  for(let i=0;i<slots.length;i++) {
    assert.equal(slots[i].delay,i*4);
    assert.ok(Math.abs(Math.hypot(slots[i].origin.x,slots[i].origin.z)-8)<1e-9);
  }
  for(let i=0;i<slots.length;i+=2) {
    assert.ok(Math.abs(slots[i].origin.x+slots[i+1].origin.x)<1e-9);
    assert.ok(Math.abs(slots[i].origin.z+slots[i+1].origin.z)<1e-9);
  }
  assert.equal(rules.blasterRingPlan({x:0,y:0,z:0},0,100).length,6);
});

test('runtime spawns a ring in sequence, fires in sequence and cancels pending heads', async () => {
  const game=await runtime({teleportSucceeds:false,bones:false});
  const heads=()=>[...game.entities.values()].filter(e=>e.typeId==='pinene_sans:blaster'&&e.isValid);
  game.step(95);assert.equal(heads().length,1);
  game.step(3);assert.equal(heads().length,1);
  game.step();assert.equal(heads().length,2);
  const center=game.player.location;
  assert.ok(Math.abs((heads()[0].location.z-center.z)+(heads()[1].location.z-center.z))<.1);
  game.step(8);assert.equal(heads().length,4);
  game.step(12);assert.equal(heads().filter(e=>e.getProperty('pinene_sans:firing')).length,1);
  game.step(4);assert.equal(heads().filter(e=>e.getProperty('pinene_sans:firing')).length,2);
  const cancelled=await runtime({teleportSucceeds:false,bones:false});
  cancelled.step(95);cancelled.player.mode='Creative';cancelled.step(25);
  assert.equal([...cancelled.entities.values()].filter(e=>e.typeId==='pinene_sans:blaster').length,1);
  assert.equal([...cancelled.entities.values()].some(e=>e.typeId==='pinene_sans:blaster'&&e.isValid),false);
});


test('beam collapse smoothly narrows to zero inside the fixed firing window', () => {
  assert.equal(rules.blastWidth(0),1.05);
  for(let age=8;age<16;age++) assert.ok(rules.blastWidth(age+1)<rules.blastWidth(age));
  assert.equal(rules.blastWidth(16),0);
  assert.equal(rules.blastWidth(40),0);
  const from={x:0,y:1,z:0},to={x:0,y:1,z:10},edge={x:.65,y:0,z:5};
  assert.equal(rules.beamTouchesPlayer(from,to,edge,Math.min(.45,rules.blastWidth(8)/2)),true);
  assert.equal(rules.beamTouchesPlayer(from,to,edge,Math.min(.45,rules.blastWidth(15)/2)),false);
});


test('bone rise is harmless, active bounce shares height, and retreat is cosmetic', () => {
  const start=rules.bonePose(0,2.6);assert.ok(Math.abs(start.offsetY+2.635)<1e-9);assert.equal(start.damaging,false);
  const rising=rules.bonePose(15,2.6);assert.ok(rising.offsetY<0 && rising.offsetY>-2.6);assert.equal(rising.damaging,false);
  assert.equal(rules.bonePose(18,2.6).damaging,true);
  assert.ok(rules.bonePose(19,2.6).height>2.6);
  assert.equal(rules.bonePose(83,2.6).damaging,false);
  assert.ok(Math.abs(rules.bonePose(90,2.6).offsetY+2.635)<1e-9);
});

test('runtime spikes spawn every five ticks and cancel their pending stream on cleanup',async()=>{
 const game=await runtime({teleportSucceeds:false});game.step(30);
 const all=type=>[...game.entities.values()].filter(e=>e.typeId===type);
 const first=all('pinene_sans:bone')[0],buried=first.location.y;
 assert.equal(all('pinene_sans:bone').length,1);
 game.step(4);assert.equal(all('pinene_sans:bone').length,1);
 game.step();assert.equal(all('pinene_sans:bone').length,2);
 game.step(5);assert.ok(first.location.y>buried);
 assert.equal(first.getProperty('pinene_sans:tilt'),2+26*Math.pow(.5,1.25));
 game.player.mode='Creative';game.step(40);
 assert.equal(all('pinene_sans:bone').some(e=>e.isValid),false);
 assert.equal(all('pinene_sans:ray').some(e=>e.isValid),false);
 assert.equal(all('pinene_sans:bone').length,3);
});

test('bone emergence sounds once at rise, stays silent during warning and cancels with stream',async()=>{
 const game=await runtime({teleportSucceeds:false});game.step(30);
 const count=()=>game.soundEvents.filter(id=>id==='pinene_sans.bone_emerge').length;
 assert.equal(count(),0);game.step(9);assert.equal(count(),0);
 game.step();assert.equal(count(),1);
 game.step(4);assert.equal(count(),1);
 game.step();assert.equal(count(),2);
 game.player.mode='Creative';game.step(40);assert.equal(count(),2);
 assert.deepEqual(game.errors,[]);
});

test('tilted spike collision covers the exposed segment, while retreat is harmless',()=>{
 const p=rules.boneSpikePlan({x:0,y:0,z:0},45,55,1.5,3);
 assert.ok(Math.abs(Math.hypot(...Object.values(p.direction))-1)<1e-10);
 assert.equal(rules.boneSpikePose(9,3).presence,0);
 assert.equal(rules.boneSpikePose(9,3).damaging,false);
 const rise=rules.boneSpikePose(10,3),full=rules.boneSpikePose(13,3);
 assert.ok(rise.presence>0&&rise.presence<1);assert.equal(full.presence,1);
 assert.equal(rules.boneSpikePose(24,3).damaging,false);
 assert.equal(rules.boneSpikePose(31,3).presence,0);
 const seg=rules.boneSpikeSegment(p,full);
 assert.ok(Math.abs(Math.sqrt(rules.distanceSquared(seg.start,seg.end))-p.length*.62)<1e-9);
 assert.ok(full.slide<-.5);
 const middle=rules.add(seg.start,rules.scale(p.direction,1.5));
 assert.equal(rules.spikeTouchesPlayer(seg.start,seg.end,{...middle,y:0}),true);
 assert.equal(rules.spikeTouchesPlayer(seg.start,seg.end,{x:10,y:0,z:10}),false);
 assert.equal(rules.spikeTouchesPlayer(seg.start,seg.start,{x:0,y:0,z:0}),false);
 assert.equal(rules.spikeTouchesPlayer({x:-1,y:.2,z:0},{x:1,y:.35,z:0},{x:0,y:0,z:0}),true);
});

test('spike lean alternates sides with variation for rotated stream headings',()=>{
 for(const heading of [0,38,155,270]){
  let seed=913;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const h=heading*Math.PI/180,left={x:-Math.cos(h),z:Math.sin(h)};
  const azimuths=[];
  for(let i=0;i<40;i++){
   const p=rules.sampleBoneSpike({x:0,y:0,z:0},random,i,heading);
   const dot=p.direction.x*left.x+p.direction.z*left.z;
   assert.ok(i%2===0?dot>0:dot<0);
   assert.ok(p.tilt>=2&&p.tilt<=28);azimuths.push(p.azimuth);
  }
  assert.ok(new Set(azimuths).size>35);
 }
});

test('gravity slam lifts then drops, requires a landing, and deals impact damage once',async()=>{
 const game=await runtime({teleportSucceeds:false,bones:false});game.wallAt(0);
 for(let i=0;i<159;i++){game.player.getComponent('minecraft:health').currentValue=20;game.step();}
 game.player.getComponent('minecraft:health').currentValue=20;
 game.step();assert.ok([...game.entities.values()].some(e=>e.typeId==='pinene_sans:soul'&&e.isValid));
 game.step(10);assert.ok(game.player.impulses.at(-1).y>0);
 game.step(12);assert.ok(game.player.impulses.at(-1).y<0);
 assert.equal(game.sans.getProperty('pinene_sans:slam'),2);
 assert.equal(game.soundEvents.filter(id=>id==='pinene_sans.gravity_cue').length,1);
 game.step(4);const hp=game.player.getComponent('minecraft:health');assert.equal(hp.currentValue,20);
 game.player.isOnGround=true;game.step();assert.equal(hp.currentValue,19);
 game.step(4);assert.equal(hp.currentValue,19);
 assert.equal(game.soundEvents.filter(id=>id==='pinene_sans.slam_impact').length,1);
 game.player.mode='Creative';game.step();
 assert.equal([...game.entities.values()].some(e=>e.typeId==='pinene_sans:soul'&&e.isValid),false);
 assert.equal(game.sans.getProperty('pinene_sans:slam'),0);
});

test('leaving during the lift cancels the pending drop and hit',async()=>{
 const game=await runtime({teleportSucceeds:false,bones:false});game.wallAt(0);
 for(let i=0;i<170;i++){game.player.getComponent('minecraft:health').currentValue=20;game.step();}
 assert.equal(game.player.impulses.length,1);
 const n=game.player.impulses.length;game.player.mode='Spectator';game.step(60);
 assert.equal(game.player.impulses.length,n);
 assert.equal([...game.entities.values()].some(e=>e.typeId==='pinene_sans:soul'&&e.isValid),false);
});
