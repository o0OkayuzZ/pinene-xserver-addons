import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireTickingAreaLease, boundsAreReadable } from '../scripts/infinite_castle/tickingAreaLease.js';
const bounds = {from:{x:-1,y:15,z:0},to:{x:17,y:33,z:17}};
function fixture(mode = 'pending') {
    const areas = new Map(), created = [], removed = [];
    const manager = {
        hasCapacity: () => true,
        createTickingArea(name) {
            created.push(name); areas.set(name, {isFullyLoaded: mode === 'loaded'});
            return mode === 'reject' ? Promise.reject(new Error('native failure')) : new Promise(() => {});
        },
        getTickingArea: name => areas.get(name),
        hasTickingArea: name => areas.has(name),
        removeTickingArea(name) { removed.push(name); areas.delete(name); },
    };
    return {manager, areas, created, removed};
}
const opts = {timeoutTicks: 5, attempts: 3, warn() {}};
test('probe covers interior chunks, vertical sections and negative coordinates', () => {
    const seen = [];
    assert.equal(boundsAreReadable({getBlock(p) { seen.push(p); return {}; }}, bounds), true);
    assert(seen.some(p => p.x === 0 && p.y === 32 && p.z === 16));
    assert(seen.some(p => p.x === -1 && p.y === 15));
    assert.equal(boundsAreReadable({getBlock(p) { return p.x === 16 && p.y === 32 ? undefined : {}; }}, bounds), false);
    assert.equal(boundsAreReadable({getBlock() { throw Error('unloaded'); }}, bounds), false);
});
test('readable bounds can complete despite a stuck native promise and retain lease', async () => {
    const f = fixture();
    const release = await acquireTickingAreaLease(f.manager, {getBlock: () => ({})}, bounds, 'test', async () => {}, opts);
    assert.equal(f.areas.size, 1);
    release(); release();
    assert.equal(f.removed.length, 1);
});
test('unreadable bounds never complete; bounded retries clean every attempt', async () => {
    const f = fixture();
    await assert.rejects(acquireTickingAreaLease(f.manager, {getBlock: () => undefined}, bounds, 'test', async () => {}, opts), /timed out/);
    assert.equal(f.created.length, 3);
    assert.equal(new Set(f.created).size, 3);
    assert.equal(f.areas.size, 0);
    assert.equal(f.removed.length, 3);
});
test('a fresh request can recover without rebuilding completed work', async () => {
    const f = fixture();
    const release = await acquireTickingAreaLease(f.manager,
        {getBlock: () => f.created.length === 2 ? {} : undefined}, bounds, 'test', async () => {}, opts);
    assert.equal(f.created.length, 2);
    assert.equal(f.removed.length, 1);
    release();
    assert.equal(f.areas.size, 0);
});
test('native errors and insufficient capacity fail cleanly', async () => {
    const f = fixture('reject');
    await assert.rejects(acquireTickingAreaLease(f.manager, {}, bounds, 'test', async () => {}, opts), /native failure/);
    assert.equal(f.areas.size, 0);
    f.manager.hasCapacity = () => false;
    await assert.rejects(acquireTickingAreaLease(f.manager, {}, bounds, 'test', async () => {}, opts), /capacity/);
    assert.equal(f.created.length, 1);
});
