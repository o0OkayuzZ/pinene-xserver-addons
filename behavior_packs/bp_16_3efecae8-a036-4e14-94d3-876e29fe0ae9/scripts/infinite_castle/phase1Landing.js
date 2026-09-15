import { acquireTickingAreaLease } from "./tickingAreaLease.js";
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
    const release = await acquireTickingAreaLease(
        manager, dimension, bounds, `ic_phase1_arrival_${++serial}`, waitTick);
    try {
        const location = findPoint();
        if (location) return { dimensionId: dimension.id, location, release };
        release();
        return null;
    } catch (error) {
        release();
        throw error;
    }
}
