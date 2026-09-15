// Temporary chunk leases shared by reconstruction and arrival.
let serial = 0;

// Check every horizontal chunk and vertical section, including the bounds' edges.
// A pending native load promise alone must not cause already readable work to restart.
export function boundsAreReadable(dimension, bounds) {
    if (typeof dimension?.getBlock !== "function") return false;
    const samples = (min, max) => {
        const values = [min];
        for (let value = (Math.floor(min / 16) + 1) * 16; value < max; value += 16) values.push(value);
        if (max !== min) values.push(max);
        return values;
    };
    try {
        for (const x of samples(bounds.from.x, bounds.to.x))
            for (const z of samples(bounds.from.z, bounds.to.z))
                for (const y of samples(bounds.from.y, bounds.to.y))
                    if (!dimension.getBlock({ x, y, z })) return false;
        return true;
    } catch {
        return false;
    }
}

export async function acquireTickingAreaLease(manager, dimension, bounds, prefix, waitTick,
    { timeoutTicks = 400, attempts = 3, warn = message => console.warn(message) } = {}) {
    if (!manager) throw new Error("world.tickingAreaManager is unavailable");
    const options = { dimension, from: bounds.from, to: bounds.to };
    const startedAt = Date.now();
    let waitedTicks = 0;
    const waitOne = async () => { await waitTick(); waitedTicks++; };
    const report = (outcome) => {
        if (waitedTicks >= 20) warn(`[ic-load-profile] ${JSON.stringify({
            prefix, outcome, waitedTicks, milliseconds: Date.now() - startedAt })}`);
    };
    for (let attempt = 0; attempt < attempts; attempt++) {
        if (!manager.hasCapacity(options)) throw new Error("No ticking area capacity for " + prefix);
        // Never reuse an identifier whose native creation promise may still be pending.
        const name = `${prefix}_lease_${++serial}`;
        let released = false;
        const release = () => {
            if (released) return;
            if (manager.hasTickingArea(name)) manager.removeTickingArea(name);
            released = true;
        };
        let resolved = false, failure;
        try {
            void manager.createTickingArea(name, options).then(
                () => { resolved = true; }, error => { failure = error; });
            for (let elapsed = 0; elapsed <= timeoutTicks; elapsed++) {
                if (failure) throw failure;
                const area = manager.getTickingArea(name);
                if (area && (resolved || area.isFullyLoaded === true)) { report("native"); return release; }
                if (area && elapsed % 5 === 0 && boundsAreReadable(dimension, bounds)) {
                    report("readable");
                    return release;
                }
                if (elapsed === 100) warn(`[ic-load-profile] waiting for chunks: ${prefix}`);
                if (elapsed < timeoutTicks) await waitOne();
            }
            const area = manager.getTickingArea(name);
            const error = new Error(`ticking area load timed out: ${name} attempt=${attempt + 1}/${attempts} `
                + `area=${area ? "present" : "missing"} fullyLoaded=${area?.isFullyLoaded ?? "unknown"} `
                + `chunks=${manager.chunkCount}/${manager.maxChunkCount} bounds=${JSON.stringify(bounds)}`);
            release();
            if (attempt + 1 === attempts) throw error;
            warn(`[infinite_castle] ${error.message}; retrying only this chunk lease`);
            // Give native removal time to finish before registering the next request.
            await waitTick();
            await waitTick();
        } catch (error) {
            release();
            throw error;
        }
    }
    throw new Error("No ticking area load attempts configured");
}
