import { PHASE1 } from "./phase1Config.js";

function profile(min, max) {
    return Object.freeze({ min, max, mean: (min + max) / 2, sigma: (max - min) / 6 });
}

// Limits are mean +/- 3 sigma. Reject outliers rather than piling them up at
// the endpoints. Units are seconds; the daylight-independent clock uses ticks.
export const RECONSTRUCTION_INTERVALS = Object.freeze({
    core: profile(PHASE1.dynamicReconstructionIntervalMinutes.min * 60,
        PHASE1.dynamicReconstructionIntervalMinutes.max * 60),
    scenery: profile(PHASE1.sceneryReconstructionIntervalSeconds.min,
        PHASE1.sceneryReconstructionIntervalSeconds.max),
});

export function drawReconstructionDelayTicks(kind, random = Math.random) {
    const settings = RECONSTRUCTION_INTERVALS[kind];
    if (!settings) throw new Error(`Unknown reconstruction timer: ${kind}`);
    // Box-Muller, truncated at 3 sigma. Bound work even for a broken RNG.
    for (let attempt = 0; attempt < 32; attempt++) {
        const u = random(), v = random();
        if (!(u >= 0 && u < 1 && v >= 0 && v < 1)) continue;
        const z = Math.sqrt(-2 * Math.log(1 - u)) * Math.cos(2 * Math.PI * v);
        if (Math.abs(z) > 3) continue;
        return Math.round((settings.mean + settings.sigma * z) * 20);
    }
    return Math.round(settings.mean * 20);
}
