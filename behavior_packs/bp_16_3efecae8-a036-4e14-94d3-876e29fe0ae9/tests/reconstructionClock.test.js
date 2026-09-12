import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { createReconstructionClock } from "../scripts/infinite_castle/reconstructionClock.js";
import { createRebuildStartCue } from "../scripts/infinite_castle/sourcePartsRebuildFeedback.js";
import { drawReconstructionDelayTicks } from "../scripts/infinite_castle/reconstructionIntervals.js";

function storage(entries = []) {
    const values = new Map(entries);
    return {
        getDynamicProperty: key => values.get(key),
        setDynamicProperty: (key, value) => value === undefined ? values.delete(key) : values.set(key, value),
        // Reproduce the affected world: server ticks advance while noon stays fixed.
        getAbsoluteTime: () => 6000,
    };
}

test("elapsed clock advances with frozen daylight and ignores time changes", () => {
    const world = storage();
    let tick = 1000;
    const now = createReconstructionClock(world, () => tick);
    assert.equal(now(), 0);
    tick += 3000;
    assert.equal(now(), 3000);
    world.getAbsoluteTime = () => 0;
    tick += 18000;
    assert.equal(now(), 21000);
    world.getAbsoluteTime = () => 1000000000;
    assert.equal(now(), 21000);
});

test("clock resumes after reload with a reset server tick and saved deadline", () => {
    const world = storage();
    let tick = 90000;
    let now = createReconstructionClock(world, () => tick);
    const due = now() + 3000;
    tick += 2000;
    assert.equal(now(), 2000);
    tick = 10;
    now = createReconstructionClock(world, () => tick);
    assert.equal(now(), 2000);
    tick += 999;
    assert.ok(now() < due);
    tick++;
    assert.equal(now(), due);
});

test("multiple reads in one tick do not advance the clock or write repeatedly", () => {
    const world = storage();
    let tick = 500, writes = 0;
    const write = world.setDynamicProperty;
    world.setDynamicProperty = (...args) => { writes++; write(...args); };
    const now = createReconstructionClock(world, () => tick);
    for (let i = 0; i < 100; i++) assert.equal(now(), 0);
    assert.equal(writes, 1);
    tick += 19;
    assert.equal(now(), 19);
    assert.equal(writes, 1);
    tick++;
    assert.equal(now(), 20);
    assert.equal(writes, 2);
});

// Execute the real manager's timer functions. Stub only the engine and the
// expensive block builders, so a regression to daylight time fails this test.
const manager = readFileSync(new URL("../scripts/infinite_castle/infiniteCastleManager.js", import.meta.url), "utf8");
const constants = manager.slice(manager.indexOf("const SOURCE_DYNAMIC_NEXT_TICK_KEY"), manager.indexOf("const returnPoints"));
const functions = manager.slice(manager.indexOf("function getSourceDynamicNextTick()"), manager.indexOf("system.runInterval(checkSceneryClock"));
function timerHarness({ deferScenery = false, playersPresent = true } = {}) {
    const world = storage([
        ["infinite_castle:scenery_next_tick_v1", 6200],
        ["infinite_castle:source_dynamic_next_tick_v1", 24000],
    ]);
    let tick = 0;
    const sounds = [], attempts = [], cores = [], draws = [];
    const players = [{ location: { x: 0, y: 80, z: 0 }, playSound: (id, options) => sounds.push({ id, options, tick }) }];
    const dimension = { id: "infinite_castle:dungeon", getPlayers: () => playersPresent ? players : [] };
    world.getDimension = () => dimension;
    const context = vm.createContext({
        world, drawReconstructionDelayTicks: kind => { draws.push({ kind, tick }); return drawReconstructionDelayTicks(kind, () => 0); }, reconstructionNow: createReconstructionClock(world, () => tick),
        USE_SOURCE_PARTS_MAIN_CASTLE: true, INFINITE_CASTLE_DIMENSION_ID: dimension.id,
        sourceDynamicReconstructionInProgress: false, dungeonResetInProgress: false, reconstructionInProgress: false,
        phase1RunState: () => "ACTIVE", getSourcePartsDemoEntranceTarget: () => ({ dimensionId: dimension.id }),
        isSourcePartsReconstructionInProgress: () => false, broadcastToDungeon() {}, console,
        async updateSourcePartsScenery(d, options) {
            attempts.push(tick);
            if (deferScenery || options.shouldYield()) return { ok: true, deferred: true };
            createRebuildStartCue(d, { scenery: true })();
            return { ok: true };
        },
        async reconstructSourcePartsAroundPlayers(d) {
            cores.push(tick);
            createRebuildStartCue(d)();
            return { ok: true };
        },
    });
    vm.runInContext(constants + functions, context);
    return { sounds, attempts, cores, draws, context,
        async advance(to) {
            for (; tick <= to; tick += 20) {
                context.checkSourceDynamicReconstruction();
                context.checkSceneryClock();
                await new Promise(resolve => setImmediate(resolve));
            }
        },
    };
}

test("real manager updates scenery with koto at sampled intervals under fixed daylight under Always Day", async () => {
    const h = timerHarness();
    await h.advance(12000);
    assert.deepEqual(h.attempts, [1360, 2720, 4080, 5440, 6800, 8160, 9520, 10880]);
    assert.deepEqual(h.cores, [12000]);
    assert.equal(h.sounds.filter(s => s.id === "infinite_castle.koto_distant").length, 8);
    assert.equal(h.sounds.filter(s => s.id === "infinite_castle.koto").length, 1);
    assert.ok(h.sounds.filter(s => s.id === "infinite_castle.koto_distant").every(s => s.options.location));
    assert.ok(h.sounds.filter(s => s.id === "infinite_castle.koto").every(s => !s.options.location));
});

test("player safety deferral still retries after 20 seconds without a false start sound", async () => {
    const h = timerHarness({ deferScenery: true });
    await h.advance(2160);
    assert.deepEqual(h.attempts, [1360, 1760, 2160]);
    assert.equal(h.sounds.length, 0);
    assert.equal(h.draws.length, 2, "deferred work does not reroll the regular interval");
});

test("checking a pending deadline does not redraw it; completion schedules the next draw once", async () => {
    const h = timerHarness();
    await h.advance(1000);
    assert.deepEqual(h.draws, [{ kind: "core", tick: 0 }, { kind: "scenery", tick: 0 }]);
    await h.advance(1360);
    assert.deepEqual(h.draws.at(-1), { kind: "scenery", tick: 1360 });
    assert.equal(h.draws.length, 3);
});

test("no players means no background or core reconstruction", async () => {
    const h = timerHarness({ playersPresent: false });
    await h.advance(19000);
    assert.equal(h.attempts.length, 0);
    assert.equal(h.cores.length, 0);
    assert.equal(h.sounds.length, 0);
});
