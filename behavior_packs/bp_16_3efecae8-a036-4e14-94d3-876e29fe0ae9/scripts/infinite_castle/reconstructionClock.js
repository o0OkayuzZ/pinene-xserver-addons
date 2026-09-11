import { world, system } from "@minecraft/server";

const CLOCK_KEY = "infinite_castle:reconstruction_elapsed_ticks_v1";

// World absolute time follows the daylight clock. Always Day and /time must
// never freeze or skip construction deadlines. Persist elapsed server ticks
// instead, since system.currentTick itself starts over on a script reload.
export function createReconstructionClock(properties, currentTick) {
    let originTick;
    let originElapsed;
    let savedAt;
    return () => {
        const tick = currentTick();
        if (originTick === undefined) {
            const saved = properties.getDynamicProperty(CLOCK_KEY);
            originElapsed = Number.isFinite(saved) && saved >= 0 ? Math.trunc(saved) : 0;
            originTick = tick;
            savedAt = tick;
            properties.setDynamicProperty(CLOCK_KEY, originElapsed);
        }
        const elapsed = originElapsed + Math.max(0, tick - originTick);
        // Checks normally run every second. At most this checkpoint interval
        // is replayed after a restart; no offline wall-clock time is counted.
        if (tick - savedAt >= 20) {
            properties.setDynamicProperty(CLOCK_KEY, elapsed);
            savedAt = tick;
        }
        return elapsed;
    };
}

export const reconstructionNow = createReconstructionClock(world, () => system.currentTick);
