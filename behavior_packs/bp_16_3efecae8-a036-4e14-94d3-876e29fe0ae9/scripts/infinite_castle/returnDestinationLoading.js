import { acquireTickingAreaLease } from "./tickingAreaLease.js";

let serial = 0;

function chunkCoordinate(value) {
    return Math.floor(value / 16);
}

function clampY(dimension, value) {
    const min = dimension?.heightRange?.min ?? -64;
    const max = dimension?.heightRange?.max ?? 320;
    return Math.max(min, Math.min(max - 1, Math.floor(value)));
}

export function returnDestinationBounds(dimension, location, radiusChunks) {
    const radius = Math.max(0, Math.floor(radiusChunks));
    const chunkX = chunkCoordinate(location.x);
    const chunkZ = chunkCoordinate(location.z);
    const y = clampY(dimension, location.y);
    return {
        from: { x: (chunkX - radius) * 16, y, z: (chunkZ - radius) * 16 },
        to: { x: (chunkX + radius) * 16 + 15, y, z: (chunkZ + radius) * 16 + 15 },
    };
}

export async function acquireReturnDestinationLease(
    manager,
    dimension,
    location,
    waitTick,
    {
        radii = [3, 2, 1, 0],
        settleTicks = 4,
        timeoutTicks = 40,
        warn = message => console.warn(message),
    } = {}
) {
    const failures = [];
    for (const radiusChunks of radii) {
        const bounds = returnDestinationBounds(dimension, location, radiusChunks);
        try {
            const release = await acquireTickingAreaLease(
                manager,
                dimension,
                bounds,
                `ic_return_${++serial}_r${radiusChunks}`,
                waitTick,
                { timeoutTicks, attempts: 1, warn }
            );
            for (let tick = 0; tick < settleTicks; tick++) await waitTick();
            return { release, radiusChunks, bounds };
        } catch (error) {
            failures.push(`r${radiusChunks}: ${error}`);
        }
    }
    throw new Error(`return destination preload failed: ${failures.join(" | ")}`);
}
