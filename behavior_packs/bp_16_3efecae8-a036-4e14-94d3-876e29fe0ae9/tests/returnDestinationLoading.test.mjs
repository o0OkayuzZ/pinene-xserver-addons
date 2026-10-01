import test from "node:test";
import assert from "node:assert/strict";
import {
    acquireReturnDestinationLease,
    returnDestinationBounds,
} from "../scripts/infinite_castle/returnDestinationLoading.js";

const dimension = {
    id: "minecraft:overworld",
    heightRange: { min: -64, max: 320 },
    getBlock() { return {}; },
};

function chunkCount(options) {
    const x = Math.floor(options.to.x / 16) - Math.floor(options.from.x / 16) + 1;
    const z = Math.floor(options.to.z / 16) - Math.floor(options.from.z / 16) + 1;
    return x * z;
}

function fixture(maxChunks) {
    const areas = new Map();
    const created = [];
    const removed = [];
    const manager = {
        chunkCount: 0,
        maxChunkCount: maxChunks,
        hasCapacity(options) { return chunkCount(options) <= maxChunks; },
        createTickingArea(name, options) {
            created.push({ name, options });
            areas.set(name, { isFullyLoaded: true });
            return Promise.resolve();
        },
        getTickingArea: name => areas.get(name),
        hasTickingArea: name => areas.has(name),
        removeTickingArea(name) { removed.push(name); areas.delete(name); },
    };
    return { manager, areas, created, removed };
}

test("return bounds are chunk aligned, include adjacent chunks, and clamp Y", () => {
    const bounds = returnDestinationBounds(dimension, { x: -1, y: 500, z: 31.9 }, 1);
    assert.deepEqual(bounds, {
        from: { x: -32, y: 319, z: 0 },
        to: { x: 15, y: 319, z: 47 },
    });
});

test("return preload prefers a 7x7 lease and settles before transfer", async () => {
    const f = fixture(64);
    let waits = 0;
    const lease = await acquireReturnDestinationLease(
        f.manager, dimension, { x: 753, y: 67, z: 2033 }, async () => { waits++; },
        { radii: [3, 2, 1, 0], settleTicks: 4, timeoutTicks: 5, warn() {} }
    );
    assert.equal(lease.radiusChunks, 3);
    assert.equal(chunkCount(f.created[0].options), 49);
    assert.equal(waits, 4);
    assert.equal(f.areas.size, 1);
    lease.release();
    assert.equal(f.removed.length, 1);
});

test("return preload degrades to the largest radius that fits current capacity", async () => {
    const f = fixture(30);
    const lease = await acquireReturnDestinationLease(
        f.manager, dimension, { x: 0, y: 64, z: 0 }, async () => {},
        { radii: [3, 2, 1, 0], settleTicks: 0, timeoutTicks: 5, warn() {} }
    );
    assert.equal(lease.radiusChunks, 2);
    assert.equal(chunkCount(f.created[0].options), 25);
    lease.release();
});

test("return preload reports failure without leaking an area", async () => {
    const f = fixture(0);
    await assert.rejects(
        acquireReturnDestinationLease(
            f.manager, dimension, { x: 0, y: 64, z: 0 }, async () => {},
            { radii: [1, 0], settleTicks: 0, timeoutTicks: 1, warn() {} }
        ),
        /return destination preload failed/
    );
    assert.equal(f.areas.size, 0);
    assert.equal(f.created.length, 0);
});
