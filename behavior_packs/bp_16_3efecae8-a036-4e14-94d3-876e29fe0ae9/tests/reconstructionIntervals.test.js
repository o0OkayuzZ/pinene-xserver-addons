import test from "node:test";
import assert from "node:assert/strict";
import { RECONSTRUCTION_INTERVALS, drawReconstructionDelayTicks } from "../scripts/infinite_castle/reconstructionIntervals.js";

function seededRandom(seed) {
    return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

test("100,000 seeded draws per timer stay bounded, symmetric and bell shaped", () => {
    for (const kind of ["core", "scenery"]) {
        const p = RECONSTRUCTION_INTERVALS[kind], random = seededRandom(20260912);
        const bins = [0, 0, 0, 0, 0];
        let sum = 0, sumSquares = 0, middleSigma = 0, endpoints = 0;
        for (let i = 0; i < 100000; i++) {
            const ticks = drawReconstructionDelayTicks(kind, random), seconds = ticks / 20;
            assert.ok(Number.isInteger(ticks) && seconds >= p.min && seconds <= p.max);
            sum += seconds; sumSquares += seconds * seconds;
            bins[Math.min(4, Math.floor((seconds - p.min) / (p.max - p.min) * 5))]++;
            if (Math.abs(seconds - p.mean) <= p.sigma) middleSigma++;
            if (seconds === p.min || seconds === p.max) endpoints++;
        }
        const mean = sum / 100000, sigma = Math.sqrt(sumSquares / 100000 - mean * mean);
        assert.ok(Math.abs(mean - p.mean) < p.sigma * 0.02);
        assert.ok(sigma > p.sigma * 0.96 && sigma < p.sigma * 1.02);
        assert.ok(middleSigma > 67000 && middleSigma < 70000);
        assert.ok(bins[0] < bins[1] && bins[1] < bins[2] && bins[2] > bins[3] && bins[3] > bins[4]);
        assert.ok(Math.abs(bins[0] - bins[4]) < 400 && Math.abs(bins[1] - bins[3]) < 800);
        assert.ok(endpoints < 50, "outliers must not be clamped into endpoint spikes");
        console.log(JSON.stringify({ kind, samples: 100000, mean, sigma, bins, middleSigma, endpoints }));
    }
});

test("out-of-range Gaussian values are rejected and sampled again, without boundary clipping", () => {
    const draws = [0.9999, 0, 0, 0];
    assert.equal(drawReconstructionDelayTicks("core", () => draws.shift()), 12000);
    assert.equal(draws.length, 0);
    assert.equal(drawReconstructionDelayTicks("scenery", () => 0), 1350);
});

test("broken RNG has a bounded fallback rather than blocking a server tick", () => {
    let calls = 0;
    assert.equal(drawReconstructionDelayTicks("scenery", () => { calls++; return 1; }), 1350);
    assert.equal(calls, 64);
    assert.throws(() => drawReconstructionDelayTicks("unknown"), /Unknown/);
});
