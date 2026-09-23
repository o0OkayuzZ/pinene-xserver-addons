import assert from 'node:assert/strict';
import test from 'node:test';
import { RepairStore, PREFIX, positionKey, regionKey, shardKey } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/repair_store.js';
import { AutoRepair, nearRegion, intersectsPlayer } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/auto_repair.js';
import { PlacementOwnership } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/placement_ownership.js';
import { LostFound } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/lost_found.js';
import { AUTO_REPAIR as config } from '../../behavior_packs/bp_17_c65bcd04-4708-4716-86bf-bbd6ab936fd3/scripts/pvp_island/config.js';

const stone = { typeId: 'minecraft:stone', states: { stone_type: 'granite' }, waterlogged: false };
const p = { x: 1, y: 64, z: 1 };
const nearby = [{ location: { x: 2, y: 70, z: 2 } }];
function fixture() {
  const data = new Map(), writes = [];
  const storage = {
    getDynamicPropertyIds: () => [...data.keys()],
    getDynamicProperty: k => data.get(k),
    setDynamicProperty(k, v) { writes.push(k); if (v === undefined) data.delete(k); else data.set(k, v); },
  };
  const store = new RepairStore(storage, config); store.load(0);
  const restored = [];
  const engine = { restore(p, entry) { restored.push({ p, entry }); return true; } };
  const repair = new AutoRepair(store, config, engine);
  const ownership = new PlacementOwnership(store), mail = new LostFound(store);
  return { data, writes, storage, store, engine, restored, repair, ownership, mail };
}
function eligible(f, at = 0) { f.repair.poll(at, []); f.repair.poll(at + config.absenceMs, []); }

test('defaults are 32/48/15 seconds/10 minutes/24 global attempts', () => {
  assert.deepEqual([config.regionSize, config.nearbyRadius, config.pollTicks, config.absenceMs, config.blocksPerTick], [32, 48, 300, 600000, 24]);
});
test('record leaves visible damage; no restoration before ten full absent minutes', () => {
  const f = fixture(); f.repair.record(p, stone, 0);
  f.repair.tick(900000, []); assert.equal(f.restored.length, 0);
  f.repair.poll(15000, []);
  f.repair.poll(614999, []); f.repair.tick(614999, []); assert.equal(f.restored.length, 0);
  f.repair.poll(615000, []); f.repair.tick(615000, []);
  assert.equal(f.restored.length, 1); assert.deepEqual(f.restored[0].entry, stone);
  assert.equal(f.store.dirtyRegions.size, 0);
});
test('nearby players indefinitely preserve dirty terrain', () => {
  const f = fixture(); f.repair.record(p, stone, 0);
  for (let t = 15000; t <= 1200000; t += 15000) { f.repair.poll(t, nearby); f.repair.tick(t, nearby); }
  assert.equal(f.restored.length, 0);
  assert.equal(f.store.regions.get('0,0').lastPlayerNearbyAt, 1200000);
});
test('return before timeout resets the entire grace period', () => {
  const f = fixture(); f.repair.record(p, stone, 0); f.repair.poll(15000, []);
  f.repair.poll(600000, nearby); f.repair.poll(615000, []);
  f.repair.poll(1214999, []); assert.equal(f.repair.active.size, 0);
  f.repair.poll(1215000, []); assert.equal(f.repair.active.size, 1);
});
test('global tick budget spans multiple regions and pauses immediately on return', () => {
  const f = fixture();
  for (let x = 0; x < 80; x++) f.repair.record({ x, y: 64, z: 0 }, stone, 0);
  eligible(f); assert.equal(f.repair.tick(600000, []), 24); assert.equal(f.restored.length, 24);
  f.repair.tick(600050, [{ location: { x: 32, y: 70, z: 0 } }]); assert.equal(f.restored.length, 24);
  assert.equal(f.repair.active.size, 0);
});
test('failed/unloaded attempts are also bounded and retried on the next poll', () => {
  const f = fixture(); let reads = 0;
  f.engine.restore = () => { reads++; throw Error('unloaded'); };
  for (let x = 0; x < 40; x++) f.repair.record({ x, y: 64, z: 0 }, stone, 0);
  eligible(f); f.repair.tick(600000, []); assert.equal(reads, 24);
  f.repair.tick(600050, []); f.repair.tick(600100, []);
  assert.equal(reads, 40); assert.equal(f.repair.active.size, 0);
  f.repair.poll(615000, []); f.engine.restore = () => true;
  f.repair.tick(615000, []); assert.ok(f.store.dirtyRegions.size);
});
test('occupied positions are deferred; repair never overwrites placement ownership', () => {
  const f = fixture(); f.repair.record(p, stone, 0);
  f.ownership.register(p, 'alice', stone, { typeId: 'minecraft:stone', amount: 1 });
  eligible(f); f.repair.tick(600000, []);
  assert.equal(f.restored.length, 0); assert.equal(f.store.dirtyRegions.size, 1);
});
test('collision overlap includes feet/head and horizontal body width', () => {
  assert.equal(intersectsPlayer(p, { location: { x: 0.7, y: 63, z: 1.5 } }), true);
  assert.equal(intersectsPlayer(p, { location: { x: 0, y: 63, z: 1.5 } }), false);
});
test('negative coordinates and edge radius use region bounds, independent of height', () => {
  assert.equal(regionKey({ x: -1, z: -33 }), '-1,-2');
  assert.equal(shardKey({ x: -1, y: -1, z: -1 }), '-1,-1,-1');
  assert.equal(nearRegion({ x: 80, y: 1000, z: 16 }, '0,0', config), true);
  assert.equal(nearRegion({ x: 80.01, z: 16 }, '0,0', config), false);
});
test('restart preserves exact permutation and restarts absence conservatively', () => {
  const f = fixture(); f.repair.record(p, stone, 0); eligible(f);
  const reloaded = new RepairStore(f.storage, config); reloaded.load(900000);
  assert.deepEqual(reloaded.get(p).dirty[positionKey(p)], stone);
  assert.equal(reloaded.regions.get('0,0').restorationState, 'waiting');
  const repair = new AutoRepair(reloaded, config, f.engine);
  repair.poll(900000, []); repair.poll(1499999, []); repair.tick(1499999, []);
  assert.equal(f.restored.length, 0);
  repair.poll(1500000, []); repair.tick(1500000, []); assert.equal(f.restored.length, 1);
});
test('a change serializes only its shard and region metadata, not unrelated regions', () => {
  const f = fixture(); f.repair.record(p, stone, 0);
  const q = { x: 500, y: 64, z: 500 }; f.repair.record(q, stone, 0);
  f.writes.length = 0; f.repair.record({ ...p, y: 65 }, stone, 100);
  assert.ok(f.writes.every(key => key === PREFIX + 's:0,16,0' || key === PREFIX + 'r:0,0'));
});
test('oversized/corrupt shards fail closed and do not mutate committed memory', () => {
  const f = fixture();
  assert.throws(() => f.store.edit(shardKey(p), data => { data.dirty.a = 'x'.repeat(31000); }), /shard full/);
  assert.equal(f.store.shards.size, 0); assert.equal(f.data.size, 0);
  f.data.set(PREFIX + 's:0,0,0', '{bad');
  assert.throws(() => new RepairStore(f.storage, config).load(0));
});
test('empty dirty state does no work', () => {
  const f = fixture(); f.repair.poll(900000, []); f.repair.tick(900000, []);
  assert.equal(f.writes.length, 0); assert.equal(f.restored.length, 0);
});
test('owned destruction is private mail, not natural terrain restoration', () => {
  const f = fixture(), item = { typeId: 'minecraft:stone', amount: 1, nameTag: 'Mine' };
  f.ownership.register(p, 'alice', stone, item);
  assert.throws(() => f.repair.record(p, stone, 0), /Owned/);
  const ref = f.ownership.beginReturn(p, [{ typeId: 'minecraft:diamond', amount: 3 }], 0);
  assert.equal(f.mail.claim('alice', () => undefined), 0); // Not removed from world yet.
  f.ownership.finishReturn(ref);
  assert.equal(f.ownership.get(p), undefined); assert.equal(f.store.dirtyRegions.size, 0);
  assert.equal(f.mail.entries('bob').length, 0);
  const received = []; assert.equal(f.mail.claim('alice', item => { received.push(item); }), 4);
  assert.deepEqual(received[0], item); assert.equal(f.mail.entries('alice').length, 0);
});
test('duplicate removal events have a single durable return transaction', () => {
  const f = fixture(); f.ownership.register(p, 'alice', stone, { typeId: 'minecraft:stone', amount: 1 });
  const a = f.ownership.beginReturn(p, [], 0), b = f.ownership.beginReturn(p, [], 1);
  assert.deepEqual(a, b); assert.equal(f.mail.entries('alice').length, 1);
});
test('full/partially full inventory retains leftovers and cannot duplicate delivered items', () => {
  const f = fixture(); f.ownership.register(p, 'alice', stone, { typeId: 'minecraft:stone', amount: 5 });
  f.ownership.finishReturn(f.ownership.beginReturn(p, [], 0));
  assert.equal(f.mail.claim('alice', item => item), 0);
  assert.equal(f.mail.claim('alice', item => ({ ...item, amount: 2 })), 3);
  assert.equal(f.mail.claim('alice', () => undefined), 2);
  assert.equal(f.mail.claim('alice', () => undefined), 0);
});
test('interrupted delivery is persisted and quarantined across restart', () => {
  const f = fixture(); f.ownership.register(p, 'alice', stone, { typeId: 'minecraft:stone', amount: 1 });
  f.ownership.finishReturn(f.ownership.beginReturn(p, [], 0));
  assert.throws(() => f.mail.claim('alice', () => { throw Error('disconnect'); }), /interrupted/);
  const s = new RepairStore(f.storage, config); s.load(100);
  const mail = new LostFound(s); assert.equal(mail.entries('alice')[0].entry.status, 'delivering');
  assert.equal(mail.claim('alice', () => { throw Error('must not retry'); }), 0);
});
test('pending world removal is recoverable after restart with ownership intact', () => {
  const f = fixture(); f.ownership.register(p, 'alice', stone, { typeId: 'minecraft:stone', amount: 1 });
  f.ownership.beginReturn(p, [], 0);
  const s = new RepairStore(f.storage, config); s.load(100);
  assert.equal(s.pending.size, 1); assert.ok(new PlacementOwnership(s).get(p));
});
test('player placement on dirty terrain returns to mail, then original natural terrain repairs', () => {
  const f = fixture(); f.repair.record(p, stone, 0);
  f.ownership.register(p, 'alice', { typeId: 'minecraft:glass', states: {} }, { typeId: 'minecraft:glass', amount: 1 });
  f.ownership.finishReturn(f.ownership.beginReturn(p, [], 0));
  eligible(f); f.repair.tick(600000, []);
  assert.equal(f.restored[0].entry.typeId, 'minecraft:stone');
  assert.equal(f.mail.entries('alice')[0].entry.items[0].typeId, 'minecraft:glass');
});
test('persistence failure never removes committed dirty entry', () => {
  const f = fixture(); f.repair.record(p, stone, 0); eligible(f);
  f.storage.setDynamicProperty = () => { throw Error('disk failure'); };
  assert.throws(() => f.repair.tick(600000, []), /disk failure/);
  assert.ok(f.store.get(p).dirty[positionKey(p)]);
});
test('region size changes require explicit migration of saved state', () => {
  const f = fixture(); f.repair.record(p, stone, 0);
  assert.throws(() => new RepairStore(f.storage, { ...config, regionSize: 64 }).load(1), /Migrate/);
});

test('admin reconciliation requires exact owner and explicit delivery decision', () => {
  const f = fixture(); f.ownership.register(p, 'alice', stone, { typeId: 'minecraft:stone', amount: 1 });
  const ref = f.ownership.beginReturn(p, [], 0); f.ownership.finishReturn(ref);
  assert.throws(() => f.mail.claim('alice', () => { throw Error('interrupted'); }));
  assert.throws(() => f.mail.reconcile('bob', ref, 1), /No matching/);
  assert.throws(() => f.mail.reconcile('alice', ref, '1'), /Explicit/);
  f.mail.reconcile('alice', ref, 0);
  assert.equal(f.mail.claim('alice', () => undefined), 1);
  assert.equal(f.mail.entries('alice').length, 0);
});
