import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { RepairStore, positionKey, shardKey } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/repair_store.js';
import { AutoRepair } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/auto_repair.js';
import { PlacementOwnership } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/placement_ownership.js';
import { LostFound } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/lost_found.js';
import { AUTO_REPAIR as config, IDS } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/config.js';

const base = '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/';
const source = readFileSync(new URL(base + 'pvp_island/repair_service.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/gm, '');
function runtime(seed = new Map()) {
  const listeners = {}, runs = [], intervals = new Map(), blocks = new Map(), data = seed, errors = [], inventory = [];
  let clock = 0, id = 0, queries = 0;
  const eventSet = names => Object.fromEntries(names.map(name => [name, { subscribe(fn) { (listeners[name] ??= []).push(fn); } }]));
  const dimension = { id: IDS.dimension, getBlock(p) { return blocks.get(positionKey(p)); } };
  const player = { id: 'alice', typeId: 'minecraft:player', dimension, location: { x: 1, y: 65, z: 1 }, isValid: true,
    messages: [], sendMessage(s) { this.messages.push(s); },
    getComponent() { return { container: { addItem(item) { inventory.push(item); } } }; } };
  const world = {
    beforeEvents: eventSet(['playerBreakBlock', 'explosion', 'playerInteractWithBlock']),
    afterEvents: eventSet(['playerPlaceBlock', 'worldLoad']),
    getDynamicPropertyIds: () => [...data.keys()], getDynamicProperty: k => data.get(k),
    setDynamicProperty(k, value) { if (value === undefined) data.delete(k); else data.set(k, value); },
    getDimension: () => dimension, getAllPlayers() { queries++; return [player]; },
  };
  const system = { currentTick: 0, afterEvents: eventSet(['scriptEventReceive']),
    run(fn) { runs.push(fn); return ++id; }, runInterval(fn, ticks) { intervals.set(++id, { fn, ticks }); return id; },
    clearRun(id) { intervals.delete(id); },
  };
  const permutationData = b => ({ typeId: b.typeId, states: b.permutation.getAllStates(), waterlogged: b.isWaterlogged });
  const samePermutation = (b, s) => b?.typeId === s.typeId && !!b.isWaterlogged === !!s.waterlogged
    && JSON.stringify(b.permutation.getAllStates()) === JSON.stringify(s.states);
  const context = vm.createContext({ world, system, config, IDS, RepairStore, positionKey, shardKey, AutoRepair,
    PlacementOwnership, LostFound, permutationData, samePermutation, packItem: s => s ? { ...s } : undefined,
    unpackItem: x => x, BlockPermutation: { resolve: (typeId, states) => ({ typeId, states }) },
    Date: { now: () => clock }, console: { error: s => errors.push(s) },
  });
  vm.runInContext(source, context);
  for (const fn of listeners.worldLoad) fn();
  const flush = () => { while (runs.length) runs.shift()(); };
  flush();
  return {
    data, world, system, dimension, player, errors, inventory, intervals,
    get queries() { return queries; },
    emit(name, event) { for (const fn of listeners[name]) fn(event); }, flush,
    tick(now = clock) { clock = now; for (const { fn, ticks } of [...intervals.values()]) if (ticks === 1) fn(); },
    poll(now = clock) { clock = now; for (const { fn, ticks } of [...intervals.values()]) if (ticks === 300) fn(); },
    block(p = { x: 1, y: 64, z: 1 }, typeId = 'minecraft:stone') {
      const block = { location: p, dimension, typeId, states: {}, isWaterlogged: false, writes: [],
        get isAir() { return this.typeId === 'minecraft:air'; },
        getComponent() {}, getItemStack() { return { typeId: this.typeId, amount: 1 }; },
        setType(type) { this.writes.push(type); this.typeId = type; this.states = {}; },
        setPermutation(perm) { this.writes.push(perm.typeId); this.typeId = perm.typeId; this.states = perm.states; },
        setWaterlogged(value) { this.isWaterlogged = value; },
      };
      block.permutation = { getAllStates: () => ({ ...block.states }) };
      blocks.set(positionKey(p), block); return block;
    },
  };
}

test('native break is cancelled, becomes air on shared worker and stays air near players', () => {
  const r = runtime(), block = r.block();
  const event = { block, player: r.player, cancel: false };
  r.emit('playerBreakBlock', event); assert.equal(event.cancel, true); assert.equal(block.isAir, false);
  r.flush(); r.tick(); assert.equal(block.isAir, true);
  assert.ok([...r.data.values()].some(raw => String(raw).includes('minecraft:stone')));
  r.poll(1200000); r.tick(1200000); assert.equal(block.isAir, true);
  assert.equal(r.errors.length, 0);
});
test('full runtime absence deadline restores original block states and waterlogging', () => {
  const r = runtime(), block = r.block(); block.states = { direction: 3 }; block.isWaterlogged = true;
  r.emit('playerBreakBlock', { block, player: r.player }); r.flush(); r.tick();
  r.player.location.x = 500;
  r.poll(15000); r.poll(614999); r.tick(614999); assert.equal(block.isAir, true);
  r.poll(615000); r.tick(615000); assert.equal(block.typeId, 'minecraft:stone');
  assert.equal(block.states.direction, 3); assert.equal(block.isWaterlogged, true);
});
test('explosion suppresses block drop pipeline and queues only eligible blocks', () => {
  const r = runtime(), block = r.block(), protectedBlock = r.block({ x: 2, y: 64, z: 1 }, IDS.islandCore);
  let impacted;
  r.emit('explosion', { dimension: r.dimension, getImpactedBlocks: () => [block, protectedBlock], setImpactedBlocks: value => { impacted = value; } });
  assert.equal(impacted.length, 0); r.flush(); r.tick();
  assert.equal(block.isAir, true); assert.equal(protectedBlock.typeId, IDS.islandCore);
});
test('BP16/overworld dimension events are untouched', () => {
  const r = runtime(), block = r.block(); block.dimension = { id: 'minecraft:overworld' };
  const event = { block, player: r.player, cancel: false };
  r.emit('playerBreakBlock', event); r.flush(); r.tick(); assert.equal(event.cancel, false); assert.equal(block.writes.length, 0);
  r.emit('explosion', { dimension: { id: 'pinene:infinite_castle' }, getImpactedBlocks() { throw Error('must not inspect'); } });
  r.emit('playerPlaceBlock', { block, player: r.player }); assert.equal(r.data.size, 0);
});
test('idle service has only the 15-second interval and no player/block scan', () => {
  const r = runtime(); r.poll(15000); r.poll(30000);
  assert.equal(r.queries, 0); assert.deepEqual([...r.intervals.values()].map(i => i.ticks), [300]);
});
test('player placement returns to placing owner, not breaker, and never becomes dirty terrain', () => {
  const r = runtime(), block = r.block();
  r.emit('playerPlaceBlock', { block, player: r.player });
  r.emit('playerBreakBlock', { block, player: { ...r.player, id: 'bob' } }); r.flush(); r.tick();
  assert.equal(block.isAir, true);
  const saved = [...r.data.values()].filter(raw => typeof raw === 'string').map(raw => JSON.parse(raw));
  const shard = saved.find(s => s.returns);
  assert.equal(Object.keys(shard.placed).length, 0); assert.equal(Object.keys(shard.dirty).length, 0);
  assert.equal(Object.values(shard.returns)[0].owner, 'alice');
  r.emit('scriptEventReceive', { id: 'pinene_pvp:lost_found', sourceEntity: r.player });
  assert.equal(r.inventory.length, 1); assert.equal(r.inventory[0].typeId, 'minecraft:stone');
});
test('registered gateway cancels break/open and privately delivers mail', () => {
  const r = runtime(), block = r.block(config.gateway, 'minecraft:air');
  r.emit('scriptEventReceive', { id: 'pinene_pvp:repair_gateway', sourceEntity: r.player });
  assert.equal(block.typeId, 'minecraft:chest');
  const interact = { block, player: r.player, isFirstEvent: true, cancel: false };
  r.emit('playerInteractWithBlock', interact); r.flush(); assert.equal(interact.cancel, true);
  const destroy = { block, player: r.player, cancel: false };
  r.emit('playerBreakBlock', destroy); assert.equal(destroy.cancel, true);
});
test('gateway refuses to overwrite terrain', () => {
  const r = runtime(), block = r.block(config.gateway);
  r.emit('scriptEventReceive', { id: 'pinene_pvp:repair_gateway', sourceEntity: r.player });
  assert.equal(block.typeId, 'minecraft:stone'); assert.equal(block.writes.length, 0);
});
test('queued stale event cannot destroy a different replacement block', () => {
  const r = runtime(), block = r.block(); r.emit('playerBreakBlock', { block, player: r.player });
  block.typeId = 'minecraft:diamond_block'; r.flush(); r.tick();
  assert.equal(block.typeId, 'minecraft:diamond_block'); assert.equal(r.data.size, 0);
});
test('protected terrain and pre-cancelled events are respected', () => {
  const r = runtime(), block = r.block(undefined, IDS.protectedStone);
  r.emit('playerBreakBlock', { block, player: r.player });
  const normal = r.block({ x: 3, y: 64, z: 1 });
  r.emit('playerBreakBlock', { block: normal, player: r.player, cancel: true }); r.flush(); r.tick();
  assert.equal(block.writes.length, 0); assert.equal(normal.writes.length, 0);
});
test('main imports service once and no forbidden per-block timer exists', () => {
  const main = readFileSync(new URL(base + 'main.js', import.meta.url), 'utf8');
  assert.equal(main.match(/import "\.\/pvp_island\/repair_service.js"/g).length, 1);
  assert.doesNotMatch(source, /system\.runTimeout/);
});
test('repair_vault residue is not a usable rendered gateway: geometry has no cubes', () => {
  const geometry = JSON.parse(readFileSync(new URL('../../resource_packs/rp_20_ef57c45f-1b60-42a3-8d26-4998db1b5055/models/entity/repair_vault.geo.json', import.meta.url)));
  assert.equal(geometry['minecraft:geometry'].flatMap(g => g.bones).flatMap(b => b.cubes ?? []).length, 0);
});

test('before-interact clones items without calling restricted item serialization APIs', () => {
  const r = runtime(), support = r.block(), placed = r.block({ x: 1, y: 65, z: 1 }, 'minecraft:glass');
  let cloned = 0;
  const stack = { clone() { cloned++; return { typeId: 'minecraft:glass', amount: 64, nameTag: 'Named' }; } };
  r.emit('playerInteractWithBlock', { block: support, player: r.player, itemStack: stack });
  r.emit('playerPlaceBlock', { block: placed, player: r.player });
  r.emit('playerBreakBlock', { block: placed, player: r.player }); r.flush(); r.tick();
  r.emit('scriptEventReceive', { id: 'pinene_pvp:lost_found', sourceEntity: r.player });
  assert.equal(cloned, 1); assert.equal(r.inventory[0].amount, 1); assert.equal(r.inventory[0].nameTag, 'Named');
});

test('owned container contents are journaled before clearing and returned without public drops', () => {
  const r = runtime(), block = r.block(undefined, 'minecraft:chest');
  let contents = [{ typeId: 'minecraft:diamond', amount: 3 }];
  const container = { get size() { return contents.length; }, getItem: i => contents[i], clearAll() {
    assert.ok([...r.data.values()].some(raw => String(raw).includes('minecraft:diamond')));
    contents = [];
  } };
  block.getComponent = key => key === 'minecraft:inventory' ? { container } : undefined;
  r.emit('playerPlaceBlock', { block, player: r.player });
  r.emit('playerBreakBlock', { block, player: r.player }); r.flush(); r.tick();
  assert.equal(contents.length, 0); assert.equal(block.isAir, true);
  r.emit('scriptEventReceive', { id: 'pinene_pvp:lost_found', sourceEntity: r.player });
  assert.equal(r.inventory.length, 2); assert.equal(r.inventory[1].typeId, 'minecraft:diamond');
});

test('natural block entities are left intact because permutation alone cannot preserve contents', () => {
  const r = runtime(), block = r.block(undefined, 'minecraft:chest');
  block.getComponent = key => key === 'minecraft:inventory' ? {} : undefined;
  r.emit('playerBreakBlock', { block, player: r.player }); r.flush(); r.tick();
  assert.equal(block.typeId, 'minecraft:chest'); assert.equal(r.data.size, 0);
});

test('both door halves are owned and breaking either returns exactly one item', () => {
  const r = runtime(), lower = r.block({ x: 1, y: 64, z: 1 }, 'minecraft:oak_door');
  const upper = r.block({ x: 1, y: 65, z: 1 }, 'minecraft:oak_door');
  lower.states = { upper_block_bit: false }; upper.states = { upper_block_bit: true };
  r.emit('playerPlaceBlock', { block: lower, player: r.player });
  r.emit('playerBreakBlock', { block: upper, player: r.player }); r.flush(); r.tick();
  assert.equal(lower.isAir, true); assert.equal(upper.isAir, true);
  r.emit('scriptEventReceive', { id: 'pinene_pvp:lost_found', sourceEntity: r.player });
  assert.equal(r.inventory.length, 1); assert.equal(r.inventory[0].amount, 1);
});

test('two-block placement credits survive synchronous neighbor removal', () => {
  const r = runtime(), lower = r.block({ x: 1, y: 64, z: 1 }, 'minecraft:oak_door');
  const upper = r.block({ x: 1, y: 65, z: 1 }, 'minecraft:oak_door');
  lower.states = { upper_block_bit: false }; upper.states = { upper_block_bit: true };
  r.emit('playerPlaceBlock', { block: lower, player: r.player });
  const oldSetType = upper.setType.bind(upper);
  upper.setType = type => { oldSetType(type); lower.typeId = 'minecraft:air'; };
  r.emit('playerBreakBlock', { block: upper, player: r.player }); r.flush(); r.tick();
  r.emit('scriptEventReceive', { id: 'pinene_pvp:lost_found', sourceEntity: r.player });
  assert.equal(r.inventory.length, 1);
});

test('restoration never overwrites a non-air replacement even without ownership', () => {
  const r = runtime(), block = r.block(); r.emit('playerBreakBlock', { block, player: r.player }); r.flush(); r.tick();
  block.typeId = 'minecraft:diamond_block'; r.player.location.x = 500;
  r.poll(15000); r.poll(615000); r.tick(615000);
  assert.equal(block.typeId, 'minecraft:diamond_block');
  assert.ok([...r.data.values()].some(raw => String(raw).includes('minecraft:stone')));
});

test('many break events use one wake-up and at most 24 removals in a tick', () => {
  const r = runtime(), blocks = [];
  for (let x = 0; x < 100; x++) {
    const block = r.block({ x, y: 64, z: 1 }); blocks.push(block);
    r.emit('playerBreakBlock', { block, player: r.player });
  }
  r.flush(); assert.equal([...r.intervals.values()].filter(i => i.ticks === 1).length, 1);
  r.tick(); assert.equal(blocks.filter(b => b.isAir).length, 24);
});

test('opaque item data is rejected before a container can be cleared', () => {
  const itemSource = readFileSync(new URL(base + 'pvp_island/repair_items.js', import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  const context = vm.createContext({}); vm.runInContext(itemSource, context);
  for (const typeId of ['minecraft:shulker_box', 'minecraft:blue_shulker_box', 'minecraft:filled_map', 'minecraft:written_book', 'minecraft:potion', 'minecraft:bundle']) {
    assert.throws(() => context.packItem({ typeId }), /Unsupported return item data/);
  }
});
