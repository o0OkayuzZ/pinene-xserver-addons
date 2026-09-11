// Keep the destination loaded from block validation through the entrance animation.
let serial = 0;
// The audited room variants and one-shot overlays use these full-height floors.
// Block.isSolid is a preview API, so stable worlds must not depend on it.
const floorTypes = new Set(["minecraft:oak_planks", "minecraft:moss_block", "minecraft:gold_block",
    "minecraft:stone", "minecraft:polished_blackstone", "minecraft:polished_deepslate"]);
export const isSafeCastleFloor = block => !!block && floorTypes.has(block.typeId);
export const blocksCastleProjectile = block => !block ||
    (!block.isAir && block.typeId !== "minecraft:air" && block.typeId !== "minecraft:light_block_15" && !block.isLiquid);

export async function acquireLandingArea(manager, dimension, bounds, findPoint, waitTick) {
    if (!manager) throw new Error("world.tickingAreaManager is unavailable");
    const name = `ic_phase1_arrival_${++serial}`;
    const options = { dimension, from: bounds.from, to: bounds.to };
    if (!manager.hasCapacity(options)) throw new Error("No ticking area capacity for castle arrival");
    let released = false;
    const release = () => {
        if (released) return;
        released = true;
        if (manager.hasTickingArea(name)) manager.removeTickingArea(name);
    };
    try {
        let resolved = false, failure;
        void manager.createTickingArea(name, options).then(
            () => { resolved = true; },
            error => { failure = error; },
        );
        for (let elapsed = 0; elapsed < 400; elapsed++) {
            if (failure) throw failure;
            if (resolved || manager.getTickingArea(name)?.isFullyLoaded === true) {
                const location = findPoint();
                if (location) return { dimensionId: dimension.id, location, release };
                release();
                return null;
            }
            await waitTick();
        }
        throw new Error("Castle arrival chunk load timed out");
    } catch (error) {
        release();
        throw error;
    }
}
