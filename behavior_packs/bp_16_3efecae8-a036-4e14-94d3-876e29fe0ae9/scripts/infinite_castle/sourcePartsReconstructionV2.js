import { BlockPermutation, BlockVolume, StructureAnimationMode, system, world } from "@minecraft/server";
import { createSourcePartsPlan, sourcePartsTopologyIds } from "./sourcePartsPlanner.js";
import { prepareRoomEncounterRemoval } from "./sourceRoomEncounters.js";
import { createRebuildStartCue } from "./sourcePartsRebuildFeedback.js";
import { assertVisualTestSafety, beginVisualTest, endVisualTest } from "./sourcePartsVisualTestGuard.js";
import { parseSourcePartsPlans, serializeSourcePartsState } from "./sourcePartsState.js";
import {
    DEFAULT_STAIR_SMOOTHING_STYLE,
    STAIR_SMOOTHING_STYLE,
    createPlanStairSmoothingOperations,
    normalizeStairSmoothingStyle,
} from "./sourcePartsStairSmoothing.js";
import { parseSourcePartsRebuildOptions } from "./sourcePartsRebuildOptions.js";
import {
    countPlanPlacementIntegrityProbes,
    createPlanPlacementIntegrityGroups,
} from "./sourcePartsPlacementIntegrity.js";
import {
    activateSourcePartsDemo,
    deactivateSourcePartsDemo,
    getSourcePartsDemoLayoutSnapshot,
} from "./sourcePartsDemoRuntime.js";
import { clipBoundsToHeight, fitPlanToHeightRange, splitBoundsForFill } from "./sourcePartsVolumes.js";
import {
    classifySourcePlayerLocations,
    createAnchoredSourcePartsReconstruction,
    createAnchoredSourcePartsReconstructionAsync,
    createStationarySourcePartsReconstruction,
    restoreSourcePartsPlanFromRoomSnapshot,
    sourcePlacementsIntersectingBounds,
    sourcePlayerSafetyBounds,
} from "./sourcePartsDynamicReconstruction.js";
import { createConnectionClearance } from "./sourcePartsConnectionClearance.js";
import { SCENERY_CORE_CLEARANCE, createSourcePartsSceneryPlanAsync } from "./sourcePartsSceneryPlanner.js";
import {
    clearSourcePartsScenery,
    ensureSourcePartsScenery,
    getSourcePartsSceneryGuard,
    getSourcePartsSceneryStatus,
    getSourcePartsSceneryRelocationGuard,
    isSourcePartsSceneryInProgress,
    prepareSourcePartsSceneryForCore,
    prepareSourcePartsSceneryForDynamicCore,
    rebuildSourcePartsSceneryCluster,
} from "./sourcePartsScenery.js";

// Keep the V2 key so the first V3 rebuild can remove the previously generated test castle.
const STATE_KEY = "infinite_castle:source_parts_test_state_v2";
const DETAILED_PLAN_KEY = "infinite_castle:source_parts_detailed_plan_v1";
const SCENERY_DIMENSION_ID = "infinite_castle:dungeon";
// Builds made before the compact V2 state was introduced used this key.  Read it
// until a successful rebuild/clear so old source-part tests do not become orphans.
const LEGACY_STATE_KEYS = Object.freeze([
    "infinite_castle:source_parts_test_state",
]);
const LOAD_MARGIN = 2;
const BUILD_SETTLE_TICKS = 10;
const DYNAMIC_BUILD_SETTLE_TICKS = 4;
const DYNAMIC_VERIFY_SETTLE_TICKS = 10;
// The visible placement wave is paced to at least twenty seconds.  Block fills,
// ticking-area loads, integrity work, and player waits all count toward this
// deadline, so a slow device never receives extra artificial delay.
const DYNAMIC_WAVE_TARGET_TICKS = 20 * 20;
// Preserve the occupied authored room and its directly connected neighbours.
// Two hops over-protected neighbours-of-neighbours and left too little freedom
// once decorative infill was moved close to the playable castle.
const DYNAMIC_PROTECTION_HOPS = 1;
const DYNAMIC_CANDIDATE_ATTEMPTS = 1;
const DYNAMIC_SEED_STEP = 0x9e3779b9;
const PLAYER_GUARD_WAIT_TICKS = 5;
const PLAYER_GUARD_NOTICE_TICKS = 200;
const SEAM_CLEARANCE = 3;
const SMOOTHING_BATCH_SIZE = 128;
const STAIR_SETTLE_ATTEMPTS = 20;
const STAIR_SETTLE_INTERVAL_TICKS = 2;
const PLACEMENT_STABILITY_MAX_REPAIR_PASSES = 3;
const PLACEMENT_STABILITY_CONFIRM_TICKS = 20;
const GEOMETRY_MAX_CYCLES = 3;
const INTEGRITY_BATCH_SIZE = 256;
const TICKING_AREA_LOAD_TIMEOUT_TICKS = 400;
const DYNAMIC_TIER_ORDER = Object.freeze(["lower", "middle", "upper"]);
let reconstructionInProgress = false;

function planDescriptor(plan) {
    const anchor = plan?.tierBases?.lower;
    if (!plan?.dimensionId || !anchor || !plan?.style || !plan?.topologyId
        || !Number.isFinite(plan?.seed)) return null;
    return {
        v: 2,
        d: plan.dimensionId,
        s: plan.seed >>> 0,
        t: plan.style,
        o: plan.topologyId,
        a: [Math.trunc(anchor.x), Math.trunc(anchor.y), Math.trunc(anchor.z)],
    };
}

function saveDetailedPlan(plan) {
    const descriptor = planDescriptor(plan);
    if (!descriptor) throw new Error("cannot persist incomplete source-parts plan descriptor");
    world.setDynamicProperty(DETAILED_PLAN_KEY, JSON.stringify(descriptor));
}

function planFromDescriptor(dimension) {
    const raw = world.getDynamicProperty(DETAILED_PLAN_KEY);
    if (typeof raw !== "string") return null;
    try {
        const value = JSON.parse(raw);
        if (![1, 2].includes(value?.v) || value?.d !== dimension.id
            || !Number.isFinite(value?.s) || !["castle", "floating"].includes(value?.t)
            || (value.v === 2 && (typeof value?.o !== "string" || value.o.length === 0))
            || !Array.isArray(value?.a) || value.a.length !== 3
            || !value.a.every(Number.isFinite)) return null;
        const plan = createSourcePartsPlan(value.s >>> 0, {
            x: Math.trunc(value.a[0]),
            y: Math.trunc(value.a[1]),
            z: Math.trunc(value.a[2]),
        }, {
            style: value.t,
            // v1 descriptors predate topology variants and therefore restore
            // through the planner's legacy-per-style default.
            ...(value.v === 2 ? { topology: value.o } : {}),
        });
        plan.dimensionId = dimension.id;
        fitPlanToHeightRange(plan, dimension.heightRange);
        return plan;
    } catch (error) {
        console.warn(`[infinite_castle] ignored invalid detailed source plan: ${error}`);
        return null;
    }
}

function restoreDetailedPlan(dimension) {
    const saved = planFromDescriptor(dimension);
    if (saved) return saved;
    const restored = restoreSourcePartsPlanFromRoomSnapshot(
        getSourcePartsDemoLayoutSnapshot(),
        dimension.heightRange
    );
    if (restored) saveDetailedPlan(restored);
    return restored;
}

function safeSendMessage(player, message) {
    try {
        player?.sendMessage(message);
    } catch {
        // The requesting player can leave or change state during the long phased build.
    }
}

async function waitTicks(ticks) {
    await system.waitTicks(ticks);
    assertVisualTestSafety();
}

function addScaled(origin, vector, scale) {
    return {
        x: origin.x + vector.x * scale,
        y: origin.y + vector.y * scale,
        z: origin.z + vector.z * scale,
    };
}

function directionVector(direction) {
    return {
        north: { x: 0, y: 0, z: -1 }, south: { x: 0, y: 0, z: 1 },
        west: { x: -1, y: 0, z: 0 }, east: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 1, z: 0 }, down: { x: 0, y: -1, z: 0 },
    }[direction];
}

function pointKey(point) {
    return `${point.x},${point.y},${point.z}`;
}

function validPoint(point) {
    return point
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        && Number.isFinite(point.z);
}

function placementBounds(placement) {
    return {
        from: { ...placement.origin },
        to: {
            x: placement.origin.x + placement.size.x - 1,
            y: placement.origin.y + placement.size.y - 1,
            z: placement.origin.z + placement.size.z - 1,
        },
    };
}

function nonnegativeInteger(value) {
    return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

function legacyConnectionBounds(connection) {
    const direction = {
        x: Math.sign(connection.to.x - connection.from.x),
        y: Math.sign(connection.to.y - connection.from.y),
        z: Math.sign(connection.to.z - connection.from.z),
    };
    const from = addScaled(
        connection.from, direction, -nonnegativeInteger(connection.fromPenetration)
    );
    const to = addScaled(
        connection.to, direction, nonnegativeInteger(connection.toPenetration)
    );
    const padding = Math.max(3, Math.ceil((connection.opening?.width ?? 1) / 2) + 1);
    return {
        from: {
            x: Math.min(from.x, to.x) - padding,
            y: Math.min(from.y, to.y) - padding,
            z: Math.min(from.z, to.z) - padding,
        },
        to: {
            x: Math.max(from.x, to.x) + padding,
            y: Math.max(from.y, to.y) + padding,
            z: Math.max(from.z, to.z) + padding,
        },
    };
}

function connectionBounds(connection) {
    const clearance = connection.mode === "authored_seam" ? createConnectionClearance(connection) : null;
    const points = [
        connection.from,
        connection.to,
        ...(connection.fromLanes ?? []),
        ...(connection.toLanes ?? []),
        ...(connection.fromCarve ?? []),
        ...(connection.toCarve ?? []),
        ...(clearance?.air ?? []),
        ...(clearance?.supports ?? []),
    ].filter(validPoint);
    if (connection.mode !== "authored_seam" || points.length < 2) {
        return legacyConnectionBounds(connection);
    }
    // Includes the three-block interior doorway penetration and its support row.
    const padding = 4;
    return {
        from: {
            x: Math.min(...points.map((point) => point.x)) - padding,
            y: Math.min(...points.map((point) => point.y)) - padding,
            z: Math.min(...points.map((point) => point.z)) - padding,
        },
        to: {
            x: Math.max(...points.map((point) => point.x)) + padding,
            y: Math.max(...points.map((point) => point.y)) + padding,
            z: Math.max(...points.map((point) => point.z)) + padding,
        },
    };
}

function expandBounds(bounds) {
    return {
        from: {
            x: bounds.from.x - LOAD_MARGIN,
            y: bounds.from.y - LOAD_MARGIN,
            z: bounds.from.z - LOAD_MARGIN,
        },
        to: {
            x: bounds.to.x + LOAD_MARGIN,
            y: bounds.to.y + LOAD_MARGIN,
            z: bounds.to.z + LOAD_MARGIN,
        },
    };
}

function releaseArea(name, manager) {
    try {
        if (manager?.hasTickingArea(name)) manager.removeTickingArea(name);
    } catch {
        // Removal is deliberately idempotent.
    }
}

async function waitForTickingAreaLoaded(manager, name, options) {
    let creationResolved = false;
    let creationError = null;
    const creation = manager.createTickingArea(name, options);
    void creation.then(
        () => { creationResolved = true; },
        (error) => { creationError = error; }
    );
    for (let elapsed = 0; elapsed < TICKING_AREA_LOAD_TIMEOUT_TICKS; elapsed += 1) {
        if (creationError) throw creationError;
        const area = manager.getTickingArea(name);
        // The documented promise has no timeout guarantee.  Bedrock can leave
        // it pending even after the temporary area reports itself fully loaded,
        // so accept either independently verifiable completion signal.
        if (creationResolved || area?.isFullyLoaded === true) return;
        await waitTicks(1);
    }
    const area = manager.getTickingArea(name);
    throw new Error(
        `ticking area load timeout: ${name} area=${area ? "present" : "missing"} `
        + `fullyLoaded=${area?.isFullyLoaded ?? "unknown"} `
        + `chunks=${manager.chunkCount}/${manager.maxChunkCount} `
        + `from=${pointKey(options.from)} to=${pointKey(options.to)}`
    );
}

async function withLoadedBounds(dimension, bounds, name, callback) {
    assertVisualTestSafety(dimension);
    const manager = world.tickingAreaManager;
    if (!manager) throw new Error("world.tickingAreaManager is unavailable");
    const expanded = clipBoundsToHeight(expandBounds(bounds), dimension.heightRange);
    if (!expanded) throw new Error(`loaded bounds are outside dimension height: ${name}`);
    const options = { dimension, from: expanded.from, to: expanded.to };
    releaseArea(name, manager);
    if (!manager.hasCapacity(options)) throw new Error(`insufficient ticking area capacity: ${name}`);
    try {
        await waitForTickingAreaLoaded(manager, name, options);
        assertVisualTestSafety(dimension);
        return await callback();
    } finally {
        releaseArea(name, manager);
        // Do not remove one temporary area and create the next in the same
        // engine tick; the native manager can otherwise retain a pending load.
        await waitTicks(1);
    }
}

function loadStoredPlans() {
    const plans = [];
    const signatures = new Set();
    for (const key of [STATE_KEY, ...LEGACY_STATE_KEYS]) {
        for (const plan of parseSourcePartsPlans(world.getDynamicProperty(key))) {
            const signature = JSON.stringify(plan);
            if (signatures.has(signature)) continue;
            signatures.add(signature);
            plans.push(plan);
        }
    }
    return plans;
}

function loadReconstructionStateStatus() {
    const raw = world.getDynamicProperty(STATE_KEY);
    if (typeof raw !== "string") return null;
    try {
        const value = JSON.parse(raw);
        return typeof value?.status === "string" ? value.status : null;
    } catch {
        return null;
    }
}

function recoveryPointSignature(point) {
    if (!validPoint(point)) return "invalid";
    return `${Math.trunc(point.x)},${Math.trunc(point.y)},${Math.trunc(point.z)}`;
}

// Compact recovery state omits variant/placement ids by design. Compare only
// the physical envelopes it can faithfully retain, independent of array or
// connection direction ordering.
function recoveryPlanGeometrySignature(plan) {
    const placements = (plan?.placements ?? []).map((placement) => [
        recoveryPointSignature(placement?.origin),
        recoveryPointSignature(placement?.size),
    ].join("/"));
    const connections = (plan?.connections ?? []).map((connection) => {
        const endpoints = [
            recoveryPointSignature(connection?.from),
            recoveryPointSignature(connection?.to),
        ].sort();
        const width = Number.isFinite(connection?.opening?.width)
            ? Math.max(1, Math.trunc(connection.opening.width)) : 1;
        return `${endpoints[0]}/${endpoints[1]}/w${width}`;
    });
    return [
        String(plan?.dimensionId ?? plan?.dimension?.id ?? "unknown"),
        `p=${placements.sort().join(";")}`,
        `c=${connections.sort().join(";")}`,
    ].join("|");
}

function interruptedDynamicStatus(status) {
    return status === "dynamic_rebuilding"
        || status === "dynamic_recovering"
        || status === "dynamic_recovery_sync"
        || status === "dynamic_recovered";
}

function saveReconstructionState(status, plans) {
    world.setDynamicProperty(STATE_KEY, serializeSourcePartsState(status, plans));
}

function clearLegacyReconstructionState() {
    for (const key of LEGACY_STATE_KEYS) world.setDynamicProperty(key, undefined);
}

function resolveStructureId(variantId, packIds) {
    const expected = `infinite_castle:generated_variants/${variantId}`;
    if (packIds.includes(expected)) return expected;
    return packIds.find((id) =>
        id.endsWith(`:generated_variants/${variantId}`)
        || id.endsWith(`/generated_variants/${variantId}`)
        || id.endsWith(`:${variantId}`)
        || id.endsWith(`/${variantId}`)
    ) ?? null;
}

async function clearPlan(plan) {
    let dimension;
    try {
        dimension = world.getDimension(plan.dimensionId);
    } catch {
        return 0;
    }
    const bounds = [
        ...plan.placements.map(placementBounds),
        ...plan.connections.map(connectionBounds),
    ];
    let clearedRegions = 0;
    for (let boundsIndex = 0; boundsIndex < bounds.length; boundsIndex += 1) {
        const clipped = clipBoundsToHeight(bounds[boundsIndex], dimension.heightRange);
        if (!clipped) continue;
        const sections = splitBoundsForFill(clipped);
        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
            const current = sections[sectionIndex];
            await withLoadedBounds(
                dimension,
                current,
                `ic_v3_clear_${boundsIndex}_${sectionIndex}`,
                async () => {
                    prepareRoomEncounterRemoval(dimension, current);
                    dimension.fillBlocks(new BlockVolume(current.from, current.to), "minecraft:air");
                }
            );
            clearedRegions += 1;
            await waitTicks(1);
        }
    }
    return clearedRegions;
}

function intersectBounds(left, right) {
    const from = {
        x: Math.max(left.from.x, right.from.x),
        y: Math.max(left.from.y, right.from.y),
        z: Math.max(left.from.z, right.from.z),
    };
    const to = {
        x: Math.min(left.to.x, right.to.x),
        y: Math.min(left.to.y, right.to.y),
        z: Math.min(left.to.z, right.to.z),
    };
    return from.x <= to.x && from.y <= to.y && from.z <= to.z ? { from, to } : null;
}

function dynamicTierBand(placement) {
    const tier = placement?.tier;
    if (tier === "upper" || tier === "transition_middle_upper") return "upper";
    if (tier === "middle" || tier === "transition_lower_middle") return "middle";
    return "lower";
}

function placementGraphDistances(plan, startingIds) {
    const distances = new Map();
    const adjacency = new Map((plan?.placements ?? []).map((placement) => [
        placement.placementId,
        [],
    ]));
    for (const connection of plan?.connections ?? []) {
        const from = connection.fromPlacementId;
        const to = connection.toPlacementId;
        if (!adjacency.has(from) || !adjacency.has(to)) continue;
        adjacency.get(from).push(to);
        adjacency.get(to).push(from);
    }
    const queue = [];
    for (const placementId of startingIds ?? []) {
        if (!adjacency.has(placementId) || distances.has(placementId)) continue;
        distances.set(placementId, 0);
        queue.push(placementId);
    }
    for (let index = 0; index < queue.length; index += 1) {
        const placementId = queue[index];
        const nextDistance = distances.get(placementId) + 1;
        for (const adjacentId of adjacency.get(placementId) ?? []) {
            if (distances.has(adjacentId)) continue;
            distances.set(adjacentId, nextDistance);
            queue.push(adjacentId);
        }
    }
    return distances;
}

function roundRobinDynamicPlacements(plan, placements, startingIds) {
    const distances = placementGraphDistances(plan, startingIds);
    const queues = Object.fromEntries(DYNAMIC_TIER_ORDER.map((tier) => [tier, []]));
    for (const placement of placements) queues[dynamicTierBand(placement)].push(placement);
    for (const queue of Object.values(queues)) {
        queue.sort((left, right) =>
            (distances.get(left.placementId) ?? Number.MAX_SAFE_INTEGER)
                - (distances.get(right.placementId) ?? Number.MAX_SAFE_INTEGER)
            || String(left.placementId).localeCompare(String(right.placementId))
        );
    }
    const ordered = [];
    while (DYNAMIC_TIER_ORDER.some((tier) => queues[tier].length > 0)) {
        for (const tier of DYNAMIC_TIER_ORDER) {
            const placement = queues[tier].shift();
            if (placement) ordered.push(placement);
        }
    }
    return ordered;
}

function placementMap(plan, label) {
    const result = new Map();
    for (const placement of plan?.placements ?? []) {
        const placementId = placement?.placementId;
        if (typeof placementId !== "string" || placementId.length === 0) {
            throw new Error(`${label} plan contains a placement without an id`);
        }
        if (result.has(placementId)) throw new Error(`${label} plan repeats ${placementId}`);
        result.set(placementId, placement);
    }
    return result;
}

/**
 * Produces a deterministic lower/middle/upper placement wave.  A new structure
 * is never built until every mutable old structure intersecting its AABB has a
 * preceding clear step.  The complementary assertion in appendClear guarantees
 * that no later clear can erase a structure that this schedule already built.
 */
export function createDynamicRebuildSchedule(
    oldPlan,
    newPlan,
    protectedOldPlacementIds = [],
    protectedNewPlacementIds = []
) {
    const oldById = placementMap(oldPlan, "old");
    const newById = placementMap(newPlan, "new");
    const protectedOld = new Set(protectedOldPlacementIds ?? []);
    const protectedNew = new Set(protectedNewPlacementIds ?? []);
    for (const placementId of protectedOld) {
        if (!oldById.has(placementId)) throw new Error(`unknown protected old placement ${placementId}`);
    }
    for (const placementId of protectedNew) {
        if (!newById.has(placementId)) throw new Error(`unknown protected new placement ${placementId}`);
    }

    const mutableOld = [...oldById.values()].filter((placement) =>
        !protectedOld.has(placement.placementId)
    );
    const mutableNew = [...newById.values()].filter((placement) =>
        !protectedNew.has(placement.placementId)
    );
    const orderedOld = roundRobinDynamicPlacements(oldPlan, mutableOld, protectedOld);
    const orderedNew = roundRobinDynamicPlacements(newPlan, mutableNew, protectedNew);
    const oldRank = new Map(orderedOld.map((placement, index) => [placement.placementId, index]));
    const clearedOld = new Set();
    const builtNew = new Set(protectedNew);
    const steps = [];

    const builtPlacements = () => [...builtNew]
        .map((placementId) => newById.get(placementId))
        .filter(Boolean);
    const appendClear = (placement, waveIndex, reason) => {
        if (clearedOld.has(placement.placementId)) return;
        const collision = builtPlacements().find((built) =>
            !protectedNew.has(built.placementId)
            && intersectBounds(placementBounds(placement), placementBounds(built)) !== null
        );
        if (collision) {
            throw new Error(
                `unsafe dynamic schedule clears ${placement.placementId} after building `
                + collision.placementId
            );
        }
        steps.push({
            phase: "clear",
            tier: dynamicTierBand(placement),
            placementId: placement.placementId,
            waveIndex,
            reason,
        });
        clearedOld.add(placement.placementId);
    };

    // Authored room eaves may have a tiny AABB overlap.  Clear those old bodies
    // first; the runtime subtracts the exact protected structure bounds so the
    // retained body itself is never touched.
    for (const oldPlacement of mutableOld) {
        const retained = builtPlacements().find((newPlacement) =>
            intersectBounds(placementBounds(oldPlacement), placementBounds(newPlacement)) !== null
        );
        if (retained) appendClear(oldPlacement, -1, "protected_overlap");
    }

    for (let waveIndex = 0; waveIndex < orderedNew.length; waveIndex += 1) {
        const newPlacement = orderedNew[waveIndex];
        const blockers = mutableOld
            .filter((oldPlacement) =>
                !clearedOld.has(oldPlacement.placementId)
                && intersectBounds(
                    placementBounds(oldPlacement), placementBounds(newPlacement)
                ) !== null
            )
            .sort((left, right) =>
                oldRank.get(left.placementId) - oldRank.get(right.placementId)
            );
        for (const blocker of blockers) appendClear(blocker, waveIndex, "build_blocker");

        // When geometry did not require a blocker, pair one removal with this
        // appearance so the two complete layouts do not coexist.  A blocker is
        // already that wave's removal and must not cause the old side to race ahead.
        if (blockers.length === 0) {
            const pairedOld = orderedOld.find((oldPlacement) =>
                !clearedOld.has(oldPlacement.placementId)
                && dynamicTierBand(oldPlacement) === dynamicTierBand(newPlacement)
            ) ?? orderedOld.find((oldPlacement) => !clearedOld.has(oldPlacement.placementId));
            if (pairedOld) appendClear(pairedOld, waveIndex, "wave_pair");
        }

        steps.push({
            phase: "build",
            tier: dynamicTierBand(newPlacement),
            placementId: newPlacement.placementId,
            waveIndex,
            reason: "wave_build",
        });
        builtNew.add(newPlacement.placementId);
    }

    let finalWaveIndex = orderedNew.length;
    for (const oldPlacement of orderedOld) {
        if (clearedOld.has(oldPlacement.placementId)) continue;
        appendClear(oldPlacement, finalWaveIndex, "old_remainder");
        finalWaveIndex += 1;
    }
    if (clearedOld.size !== mutableOld.length || builtNew.size !== newById.size) {
        throw new Error("dynamic reconstruction schedule is incomplete");
    }
    return {
        steps,
        mutableOldPlacementIds: orderedOld.map((placement) => placement.placementId),
        mutableNewPlacementIds: orderedNew.map((placement) => placement.placementId),
        targetTicks: DYNAMIC_WAVE_TARGET_TICKS,
    };
}

function pointSetSignature(points) {
    return [...new Set((points ?? []).filter(validPoint).map(pointKey))].sort().join(";");
}

export function dynamicConnectionWorldSignature(connection) {
    let clearance = { air: [], supports: [] };
    try {
        clearance = createConnectionClearance(connection);
    } catch {
        // The actual seam operation will report malformed authored geometry.
    }
    return [
        connection?.mode ?? "missing",
        connection?.floorNormal ?? "missing",
        `air=${pointSetSignature([
            ...(connection?.fromLanes ?? []),
            ...(connection?.toLanes ?? []),
            ...(connection?.fromCarve ?? []),
            ...(connection?.toCarve ?? []),
            ...(clearance.air ?? []),
        ])}`,
        `support=${pointSetSignature(clearance.supports ?? [])}`,
    ].join("|");
}

function livePlayerSafetyEntries(dimension) {
    return dimension.getPlayers().flatMap((player) => {
        const bounds = sourcePlayerSafetyBounds(player.location);
        return bounds ? [{ player, bounds }] : [];
    });
}

function playersTouchingBounds(dimension, bounds) {
    return livePlayerSafetyEntries(dimension).filter((entry) =>
        intersectBounds(bounds, entry.bounds) !== null
    );
}

/**
 * A dynamic job waits on just the operation a moving player entered.  It does
 * not fail, discard the candidate, or mark a half-built plan complete; leaving
 * the small safety envelope automatically resumes the same job.
 */
async function waitForLivePlayerClearance(dimension, bounds, operation) {
    let waitedTicks = 0;
    while (true) {
        const touching = playersTouchingBounds(dimension, bounds);
        if (touching.length === 0) return waitedTicks;
        if (waitedTicks === 0 || waitedTicks % PLAYER_GUARD_NOTICE_TICKS === 0) {
            messagePlayers(
                touching.map((entry) => entry.player),
                `[infinite_castle] 再構築区画を通過中のため ${operation} を一時待機します。離れると自動で再開します`
            );
        }
        await waitTicks(PLAYER_GUARD_WAIT_TICKS);
        waitedTicks += PLAYER_GUARD_WAIT_TICKS;
    }
}

function tightBoundsForPoints(points) {
    const valid = (points ?? []).filter(validPoint);
    if (valid.length === 0) return null;
    return {
        from: {
            x: Math.min(...valid.map((point) => point.x)),
            y: Math.min(...valid.map((point) => point.y)),
            z: Math.min(...valid.map((point) => point.z)),
        },
        to: {
            x: Math.max(...valid.map((point) => point.x)),
            y: Math.max(...valid.map((point) => point.y)),
            z: Math.max(...valid.map((point) => point.z)),
        },
    };
}

async function sealDynamicLanePoints(
    dimension,
    lanes,
    areaName,
    operation,
    strict = false
) {
    const unique = [...new Map((lanes ?? []).filter(validPoint).map((point) => [
        pointKey(point),
        point,
    ])).values()];
    const bounds = tightBoundsForPoints(unique);
    if (!bounds || unique.length === 0) return { placed: 0, retained: 0, blocked: 0 };

    // Do not occupy a scarce ticking-area slot while a player is standing in a
    // doorway.  Recheck after loading because the player can move during load.
    await waitForLivePlayerClearance(dimension, bounds, operation);
    return withLoadedBounds(dimension, bounds, areaName, async () => {
        await waitForLivePlayerClearance(dimension, bounds, operation);
        let placed = 0;
        let retained = 0;
        let blocked = 0;
        for (const point of unique) {
            const block = dimension.getBlock(point);
            if (!block) throw new Error(`dynamic socket block is unloaded at ${pointKey(point)}`);
            if (isAir(block)) {
                dimension.setBlockType(point, "minecraft:oak_fence");
                placed += 1;
            } else if (block.typeId === "minecraft:oak_fence") {
                retained += 1;
            } else if (strict) {
                throw new Error(
                    `dynamic socket has unexpected authored block at `
                    + `${pointKey(point)}=${block.typeId}`
                );
            } else {
                // A solid authored wall is already a safe temporary boundary.
                blocked += 1;
            }
        }
        await waitTicks(1);
        return { placed, retained, blocked };
    });
}

async function sealOldFrontierBeforeClear(
    oldPlan,
    clearingPlacementId,
    clearedOldPlacementIds,
    dimension,
    sealedFrontiers
) {
    let placed = 0;
    let retained = 0;
    let blocked = 0;
    for (let index = 0; index < (oldPlan?.connections ?? []).length; index += 1) {
        const connection = oldPlan.connections[index];
        let survivingPlacementId = null;
        let lanes = null;
        if (connection.fromPlacementId === clearingPlacementId) {
            survivingPlacementId = connection.toPlacementId;
            lanes = connection.toLanes;
        } else if (connection.toPlacementId === clearingPlacementId) {
            survivingPlacementId = connection.fromPlacementId;
            lanes = connection.fromLanes;
        } else {
            continue;
        }
        if (clearedOldPlacementIds.has(survivingPlacementId)) continue;
        const frontierKey = `${survivingPlacementId}:${pointSetSignature(lanes)}`;
        if (sealedFrontiers.has(frontierKey)) continue;
        const result = await sealDynamicLanePoints(
            dimension,
            lanes,
            `ic_dyn_frontier_${clearingPlacementId}_${index}`,
            `frontier:${clearingPlacementId}`
        );
        sealedFrontiers.add(frontierKey);
        placed += result.placed;
        retained += result.retained;
        blocked += result.blocked;
    }
    return { placed, retained, blocked };
}

async function sealRemovedProtectedConnections(
    oldPlan,
    newPlan,
    protectedOldPlacementIds,
    dimension,
    sealedFrontiers
) {
    const protectedOld = new Set(protectedOldPlacementIds);
    const newSignatures = new Set((newPlan?.connections ?? []).map(
        dynamicConnectionWorldSignature
    ));
    let placed = 0;
    let retained = 0;
    let blocked = 0;
    for (let index = 0; index < (oldPlan?.connections ?? []).length; index += 1) {
        const connection = oldPlan.connections[index];
        if (!protectedOld.has(connection.fromPlacementId)
            || !protectedOld.has(connection.toPlacementId)
            || newSignatures.has(dynamicConnectionWorldSignature(connection))) continue;
        const sides = [
            [connection.fromPlacementId, connection.fromLanes],
            [connection.toPlacementId, connection.toLanes],
        ];
        for (let sideIndex = 0; sideIndex < sides.length; sideIndex += 1) {
            const [placementId, lanes] = sides[sideIndex];
            const frontierKey = `${placementId}:${pointSetSignature(lanes)}`;
            if (sealedFrontiers.has(frontierKey)) continue;
            const result = await sealDynamicLanePoints(
                dimension,
                lanes,
                `ic_dyn_retained_cap_${index}_${sideIndex}`,
                `retained-cap:${placementId}`
            );
            sealedFrontiers.add(frontierKey);
            placed += result.placed;
            retained += result.retained;
            blocked += result.blocked;
        }
    }
    return { placed, retained, blocked };
}

function subtractOneBounds(bounds, exclusion) {
    const overlap = intersectBounds(bounds, exclusion);
    if (!overlap) return [bounds];
    const pieces = [];
    const push = (from, to) => {
        if (from.x <= to.x && from.y <= to.y && from.z <= to.z) pieces.push({ from, to });
    };
    push(bounds.from, { x: overlap.from.x - 1, y: bounds.to.y, z: bounds.to.z });
    push({ x: overlap.to.x + 1, y: bounds.from.y, z: bounds.from.z }, bounds.to);
    const middleXFrom = Math.max(bounds.from.x, overlap.from.x);
    const middleXTo = Math.min(bounds.to.x, overlap.to.x);
    push(
        { x: middleXFrom, y: bounds.from.y, z: bounds.from.z },
        { x: middleXTo, y: overlap.from.y - 1, z: bounds.to.z }
    );
    push(
        { x: middleXFrom, y: overlap.to.y + 1, z: bounds.from.z },
        { x: middleXTo, y: bounds.to.y, z: bounds.to.z }
    );
    const middleYFrom = Math.max(bounds.from.y, overlap.from.y);
    const middleYTo = Math.min(bounds.to.y, overlap.to.y);
    push(
        { x: middleXFrom, y: middleYFrom, z: bounds.from.z },
        { x: middleXTo, y: middleYTo, z: overlap.from.z - 1 }
    );
    push(
        { x: middleXFrom, y: middleYFrom, z: overlap.to.z + 1 },
        { x: middleXTo, y: middleYTo, z: bounds.to.z }
    );
    return pieces;
}

function subtractProtectedBounds(bounds, protectedBounds) {
    let pieces = [bounds];
    for (const exclusion of protectedBounds) {
        pieces = pieces.flatMap((piece) => subtractOneBounds(piece, exclusion));
    }
    return pieces;
}

async function clearPlanExcept(plan, protectedPlacementIds, dimension) {
    const protectedIds = new Set(protectedPlacementIds);
    const protectedBounds = plan.placements
        .filter((placement) => protectedIds.has(placement.placementId))
        .map(placementBounds);
    // Authored seams only contain carved air and are already covered by their
    // endpoint structure envelopes.  Clearing their padded diagnostic bounds
    // separately doubled ticking-area churn without removing useful blocks.
    const targets = plan.placements
        .filter((placement) => !protectedIds.has(placement.placementId))
        .map(placementBounds);
    let clearedRegions = 0;
    for (let boundsIndex = 0; boundsIndex < targets.length; boundsIndex += 1) {
        const clipped = clipBoundsToHeight(targets[boundsIndex], dimension.heightRange);
        if (!clipped) continue;
        const safePieces = subtractProtectedBounds(clipped, protectedBounds);
        for (let pieceIndex = 0; pieceIndex < safePieces.length; pieceIndex += 1) {
            for (const section of splitBoundsForFill(safePieces[pieceIndex])) {
                await withLoadedBounds(
                    dimension,
                    section,
                    `ic_dyn_clear_${boundsIndex}_${pieceIndex}_${clearedRegions}`,
                    async () => {
                        await waitForLivePlayerClearance(
                            dimension,
                            section,
                            `clear:${boundsIndex}`
                        );
                        prepareRoomEncounterRemoval(dimension, section);
                        dimension.fillBlocks(
                            new BlockVolume(section.from, section.to),
                            "minecraft:air"
                        );
                    }
                );
                clearedRegions += 1;
                await waitTicks(1);
            }
        }
    }
    return clearedRegions;
}

async function clearStoredPlans(plans, requestedBy) {
    let clearedRegions = 0;
    for (const plan of plans) clearedRegions += await clearPlan(plan);
    if (clearedRegions > 0) {
        safeSendMessage(
            requestedBy,
            `[infinite_castle] 旧テスト建築を消去しました (${clearedRegions}領域)`
        );
    }
    return clearedRegions;
}

function squaredDistanceToLocation(placement, location) {
    const center = {
        x: placement.origin.x + placement.size.x / 2,
        y: placement.origin.y + placement.size.y / 2,
        z: placement.origin.z + placement.size.z / 2,
    };
    return (center.x - location.x) ** 2
        + (center.y - location.y) ** 2
        + (center.z - location.z) ** 2;
}

async function placePlan(
    plan,
    player,
    dimension,
    startLocation,
    settleTicks = BUILD_SETTLE_TICKS
) {
    const packIds = world.structureManager.getPackStructureIds();
    const ordered = plan.placements.slice().sort((left, right) =>
        squaredDistanceToLocation(left, startLocation) - squaredDistanceToLocation(right, startLocation)
    );
    for (let index = 0; index < ordered.length; index += 1) {
        const placement = ordered[index];
        const structureId = resolveStructureId(placement.variantId, packIds);
        if (!structureId) throw new Error(`variant structure is not registered: ${placement.variantId}`);
        await withLoadedBounds(dimension, placementBounds(placement), `ic_v3_build_${index}`, async () => {
            world.structureManager.place(structureId, dimension, placement.origin, {
                // The rebuild command is a deterministic authoring/debug operation.
                // Immediate placement prevents a tall Layers animation from freezing
                // when its temporary ticking area is released before the last layer.
                animationMode: StructureAnimationMode.None,
                includeBlocks: true,
                includeEntities: true,
            });
            await waitTicks(settleTicks);
        });
        safeSendMessage(player,
            `[ic-rebuild] ${index + 1}/${ordered.length} ${placement.displayName} (${placement.variantId}) layer=${placement.layer}`
        );
    }
}

async function placePlanExcept(plan, protectedPlacementIds, players, dimension) {
    const protectedIds = new Set(protectedPlacementIds);
    const locations = players.map((player) => player.location);
    const center = locations[0] ?? plan.tierBases?.lower ?? { x: 0, y: 0, z: 0 };
    const packIds = world.structureManager.getPackStructureIds();
    const ordered = plan.placements
        .filter((placement) => !protectedIds.has(placement.placementId))
        .sort((left, right) =>
            squaredDistanceToLocation(left, center) - squaredDistanceToLocation(right, center)
        );
    for (let index = 0; index < ordered.length; index += 1) {
        const placement = ordered[index];
        const structureId = resolveStructureId(placement.variantId, packIds);
        if (!structureId) throw new Error(`variant structure is not registered: ${placement.variantId}`);
        const bounds = placementBounds(placement);
        await withLoadedBounds(dimension, bounds, `ic_dyn_build_${index}`, async () => {
            await waitForLivePlayerClearance(
                dimension,
                bounds,
                `build:${placement.placementId}`
            );
            world.structureManager.place(structureId, dimension, placement.origin, {
                animationMode: StructureAnimationMode.None,
                includeBlocks: true,
                includeEntities: true,
            });
            await waitTicks(DYNAMIC_BUILD_SETTLE_TICKS);
        });
    }
    return ordered.length;
}

async function clearDynamicPlacement(
    placement,
    protectedBounds,
    dimension,
    operationIndex
) {
    const clipped = clipBoundsToHeight(placementBounds(placement), dimension.heightRange);
    if (!clipped) return 0;
    const safePieces = subtractProtectedBounds(clipped, protectedBounds);
    let clearedRegions = 0;
    for (let pieceIndex = 0; pieceIndex < safePieces.length; pieceIndex += 1) {
        const sections = splitBoundsForFill(safePieces[pieceIndex]);
        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
            const section = sections[sectionIndex];
            await withLoadedBounds(
                dimension,
                section,
                `ic_dyn_wave_clear_${operationIndex}_${pieceIndex}_${sectionIndex}`,
                async () => {
                    await waitForLivePlayerClearance(
                        dimension,
                        section,
                        `clear:${placement.placementId}`
                    );
                    prepareRoomEncounterRemoval(dimension, section);
                    dimension.fillBlocks(
                        new BlockVolume(section.from, section.to),
                        "minecraft:air"
                    );
                }
            );
            clearedRegions += 1;
            await waitTicks(1);
        }
    }
    return clearedRegions;
}

async function clearInterruptedDynamicPlan(
    plan,
    protectedBounds,
    dimension,
    recoveryIndex
) {
    const targets = [
        ...(plan?.placements ?? []).map(placementBounds),
        ...(plan?.connections ?? []).map(connectionBounds),
    ];
    let clearedRegions = 0;
    for (let boundsIndex = 0; boundsIndex < targets.length; boundsIndex += 1) {
        const clipped = clipBoundsToHeight(targets[boundsIndex], dimension.heightRange);
        if (!clipped) continue;
        const safePieces = subtractProtectedBounds(clipped, protectedBounds);
        for (let pieceIndex = 0; pieceIndex < safePieces.length; pieceIndex += 1) {
            const sections = splitBoundsForFill(safePieces[pieceIndex]);
            for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
                const section = sections[sectionIndex];
                await withLoadedBounds(
                    dimension,
                    section,
                    `ic_dyn_recover_${recoveryIndex}_${boundsIndex}_${pieceIndex}_${sectionIndex}`,
                    async () => {
                        await waitForLivePlayerClearance(
                            dimension,
                            section,
                            `recovery:${recoveryIndex}`
                        );
                        prepareRoomEncounterRemoval(dimension, section);
                        dimension.fillBlocks(
                            new BlockVolume(section.from, section.to),
                            "minecraft:air"
                        );
                    }
                );
                clearedRegions += 1;
                await waitTicks(1);
            }
        }
    }
    return clearedRegions;
}

async function recoverInterruptedDynamicState(
    oldPlan,
    storedPlans,
    stateStatus,
    protectedOldPlacementIds,
    players,
    requestedDimension,
    playerSafetyBounds
) {
    const baselineSignature = recoveryPlanGeometrySignature(oldPlan);
    let remaining = (storedPlans ?? []).filter((plan) =>
        recoveryPlanGeometrySignature(plan) !== baselineSignature
    );
    const required = interruptedDynamicStatus(stateStatus) || remaining.length > 0;
    if (!required) {
        return { ok: true, required: false, plans: 0, clearedRegions: 0 };
    }

    const protectedOld = new Set(protectedOldPlacementIds ?? []);
    const protectedWorldBounds = (oldPlan?.placements ?? [])
        .filter((placement) => protectedOld.has(placement.placementId))
        .map(placementBounds);
    messagePlayers(
        players,
        `[infinite_castle] 中断された再構築を安全復旧します residual=${remaining.length}`
    );
    saveReconstructionState("dynamic_recovering", [oldPlan, ...remaining]);

    let clearedRegions = 0;
    const recoveredPlans = remaining.length;
    for (let recoveryIndex = 0; remaining.length > 0; recoveryIndex += 1) {
        const current = remaining[0];
        const recoveryDimension = current.dimensionId === requestedDimension.id
            ? requestedDimension
            : world.getDimension(current.dimensionId);
        const sceneryPreparation = await prepareSourcePartsSceneryForDynamicCore(
            current,
            recoveryDimension,
            players[0],
            {
                clearance: SCENERY_CORE_CLEARANCE,
                playerSafetyBounds: recoveryDimension.id === requestedDimension.id
                    ? playerSafetyBounds : [],
            }
        );
        if (!sceneryPreparation?.ok) {
            return {
                ok: false,
                required: true,
                reason: sceneryPreparation?.reason ?? "recovery_scenery",
                scenery: sceneryPreparation,
                plans: recoveredPlans,
                remaining: remaining.length,
                clearedRegions,
            };
        }
        clearedRegions += await clearInterruptedDynamicPlan(
            current,
            recoveryDimension.id === requestedDimension.id ? protectedWorldBounds : [],
            recoveryDimension,
            recoveryIndex
        );
        // The just-cleared envelope is removed only after all of its placement
        // and connection sections completed. A failure midway therefore keeps
        // the complete conservative envelope available to the next retry.
        remaining = remaining.slice(1);
        saveReconstructionState("dynamic_recovering", [oldPlan, ...remaining]);
    }

    // A failed candidate can leave a temporary fence on a retained socket or
    // an authored opening in the wrong state. Re-establish the baseline socket
    // contract before a fresh candidate is allowed to mutate the castle.
    saveReconstructionState("dynamic_recovery_sync", [oldPlan]);
    const caps = await sealUnusedAuthoredSockets(
        oldPlan,
        requestedDimension,
        new Set(),
        true
    );
    let reopenedSeamBlocks = 0;
    for (let index = 0; index < (oldPlan?.connections ?? []).length; index += 1) {
        reopenedSeamBlocks += await openAuthoredSeam(
            requestedDimension,
            oldPlan.connections[index],
            index,
            true
        );
    }
    saveReconstructionState("dynamic_recovered", [oldPlan]);
    messagePlayers(
        players,
        `[infinite_castle] 中断復旧完了 residual=${recoveredPlans} `
        + `clearedRegions=${clearedRegions} seams=${reopenedSeamBlocks} caps=${caps.sockets}`
    );
    return {
        ok: true,
        required: true,
        plans: recoveredPlans,
        clearedRegions,
        reopenedSeamBlocks,
        caps,
    };
}

async function placeDynamicPlacement(placement, dimension, operationIndex, packIds) {
    const structureId = resolveStructureId(placement.variantId, packIds);
    if (!structureId) throw new Error(`variant structure is not registered: ${placement.variantId}`);
    const bounds = placementBounds(placement);
    await withLoadedBounds(
        dimension,
        bounds,
        `ic_dyn_wave_build_${operationIndex}`,
        async () => {
            await waitForLivePlayerClearance(
                dimension,
                bounds,
                `build:${placement.placementId}`
            );
            world.structureManager.place(structureId, dimension, placement.origin, {
                animationMode: StructureAnimationMode.None,
                includeBlocks: true,
                includeEntities: true,
            });
            await waitTicks(DYNAMIC_BUILD_SETTLE_TICKS);
        }
    );
}

async function runPhasedDynamicRebuild(
    oldPlan,
    newPlan,
    protectedOldPlacementIds,
    protectedNewPlacementIds,
    players,
    dimension
) {
    const schedule = createDynamicRebuildSchedule(
        oldPlan,
        newPlan,
        protectedOldPlacementIds,
        protectedNewPlacementIds
    );
    const oldById = new Map(oldPlan.placements.map((placement) => [
        placement.placementId,
        placement,
    ]));
    const newById = new Map(newPlan.placements.map((placement) => [
        placement.placementId,
        placement,
    ]));
    const protectedOld = new Set(protectedOldPlacementIds);
    const protectedBounds = oldPlan.placements
        .filter((placement) => protectedOld.has(placement.placementId))
        .map(placementBounds);
    const packIds = world.structureManager.getPackStructureIds();
    const clearedOld = new Set();
    const sealedFrontiers = new Set();
    const availableNew = new Set(protectedNewPlacementIds);
    const openedNew = new Set();
    let placed = 0;
    let clearedRegions = 0;
    let transitionCaps = { placed: 0, retained: 0, blocked: 0 };

    const retainedCaps = await sealRemovedProtectedConnections(
        oldPlan,
        newPlan,
        protectedOldPlacementIds,
        dimension,
        sealedFrontiers
    );
    transitionCaps = retainedCaps;
    const waveStartedAt = world.getAbsoluteTime();
    const totalBuilds = schedule.mutableNewPlacementIds.length;

    for (let operationIndex = 0; operationIndex < schedule.steps.length; operationIndex += 1) {
        const step = schedule.steps[operationIndex];
        if (step.phase === "clear") {
            const placement = oldById.get(step.placementId);
            if (!placement) throw new Error(`dynamic clear references ${step.placementId}`);
            const frontier = await sealOldFrontierBeforeClear(
                oldPlan,
                placement.placementId,
                clearedOld,
                dimension,
                sealedFrontiers
            );
            transitionCaps.placed += frontier.placed;
            transitionCaps.retained += frontier.retained;
            transitionCaps.blocked += frontier.blocked;
            clearedRegions += await clearDynamicPlacement(
                placement,
                protectedBounds,
                dimension,
                operationIndex
            );
            clearedOld.add(placement.placementId);
            continue;
        }

        const placement = newById.get(step.placementId);
        if (!placement) throw new Error(`dynamic build references ${step.placementId}`);
        await placeDynamicPlacement(placement, dimension, operationIndex, packIds);
        availableNew.add(placement.placementId);
        // Open each route as soon as both ends exist. A later cap failure must
        // never leave every newly placed room waiting behind an authored wall.
        for (let seamIndex = 0; seamIndex < newPlan.connections.length; seamIndex += 1) {
            const seam = newPlan.connections[seamIndex];
            if (openedNew.has(seamIndex)
                || !availableNew.has(seam.fromPlacementId)
                || !availableNew.has(seam.toPlacementId)) continue;
            await openAuthoredSeam(dimension, seam, seamIndex, true);
            openedNew.add(seamIndex);
        }
        placed += 1;
        if (placed === 1 || placed % 3 === 0 || placed === totalBuilds) {
            messagePlayers(
                players,
                `[infinite_castle] 波状再構築 ${placed}/${totalBuilds} `
                + `layer=${step.tier}`
            );
        }

        // The operation's own fill/load/settle ticks count toward the deadline.
        // Slow hardware therefore proceeds immediately instead of accumulating
        // a backlog of artificial sleeps.
        const deadline = waveStartedAt
            + Math.floor(placed * DYNAMIC_WAVE_TARGET_TICKS / Math.max(1, totalBuilds));
        const remaining = deadline - world.getAbsoluteTime();
        if (remaining > 0) await waitTicks(remaining);
    }
    return { schedule, placed, clearedRegions, transitionCaps };
}

function integrityExpectation(probe, phase) {
    const smoothed = phase === "smoothed" && probe.smoothedExpectedTypes;
    return {
        types: smoothed ? probe.smoothedExpectedTypes : probe.expectedTypes,
        states: smoothed ? probe.smoothedExpectedStates : null,
    };
}

function isExpectedIntegrityBlock(block, probe, phase) {
    if (!block || isUnsupportedWalkSurface(block)) return false;
    const expectation = integrityExpectation(probe, phase);
    if (expectation.types && !expectation.types.includes(block.typeId)) return false;
    if (!expectation.states || block.typeId !== "minecraft:oak_stairs") return true;
    try {
        return Object.entries(expectation.states).every(([name, value]) =>
            block.permutation.getState(name) === value
        );
    } catch {
        return false;
    }
}

async function inspectPlanPlacementIntegrity(groups, dimension, scanId, phase = "authored") {
    const failedGroups = [];
    let failures = 0;
    for (let index = 0; index < groups.length; index += 1) {
        const group = groups[index];
        const groupFailures = [];
        await withLoadedBounds(
            dimension,
            placementBounds(group.placement),
            `ic_v3_probe_${scanId}_${index}`,
            async () => {
                for (let probeIndex = 0; probeIndex < group.probes.length; probeIndex += 1) {
                    const probe = group.probes[probeIndex];
                    const block = dimension.getBlock(probe.position);
                    if (!isExpectedIntegrityBlock(block, probe, phase)) {
                        const expectation = integrityExpectation(probe, phase);
                        failures += 1;
                        if (groupFailures.length < 8) {
                            groupFailures.push({
                                position: probe.position,
                                actualType: block?.typeId ?? "unloaded",
                                expectedTypes: expectation.types,
                                expectedStates: expectation.states,
                                reasons: probe.reasons,
                            });
                        }
                    }
                    if ((probeIndex + 1) % INTEGRITY_BATCH_SIZE === 0) await waitTicks(1);
                }
                // Most non-stair groups have fewer than one batch.  Keep even
                // those already-loaded areas alive across a tick before release.
                await waitTicks(1);
            }
        );
        if (groupFailures.length > 0) {
            failedGroups.push({ group, samples: groupFailures });
        }
    }
    return { failedGroups, failures };
}

function placementIntegrityError(prefix, result) {
    const placements = result.failedGroups
        .slice(0, 4)
        .map(({ group, samples }) => {
            const sample = samples[0];
            const expected = sample.expectedTypes?.join("|") ?? "solid";
            return `${group.placement.placementId}:${sample.actualType}->${expected}`
                + `@${pointKey(sample.position)}(${sample.reasons.join("+")})`;
        })
        .join(";");
    return new Error(`${prefix}: failures=${result.failures} samples=${placements}`);
}

async function replacePlacementForStability(
    group,
    dimension,
    repairPass,
    index,
    guardLivePlayers = false
) {
    const packIds = world.structureManager.getPackStructureIds();
    const placement = group.placement;
    const structureId = resolveStructureId(placement.variantId, packIds);
    if (!structureId) throw new Error(`variant structure is not registered: ${placement.variantId}`);
    await withLoadedBounds(
        dimension,
        placementBounds(placement),
        `ic_v3_repair_${repairPass}_${index}`,
        async () => {
            if (guardLivePlayers) {
                await waitForLivePlayerClearance(
                    dimension,
                    placementBounds(placement),
                    `repair:${placement.placementId}`
                );
            }
            world.structureManager.place(structureId, dimension, placement.origin, {
                animationMode: StructureAnimationMode.None,
                includeBlocks: true,
                // The initial pass already created authored entities.  A block
                // stability retry must not duplicate them.
                includeEntities: false,
            });
            await waitTicks(BUILD_SETTLE_TICKS);
        }
    );
}

async function stabilizePlanPlacements(plan, dimension, integrityGroups) {
    let scans = 0;
    let repairPasses = 0;
    let replacements = 0;
    let consecutiveCleanScans = 0;
    while (repairPasses <= PLACEMENT_STABILITY_MAX_REPAIR_PASSES) {
        const result = await inspectPlanPlacementIntegrity(
            integrityGroups, dimension, scans
        );
        scans += 1;
        if (result.failures === 0) {
            consecutiveCleanScans += 1;
            if (consecutiveCleanScans >= 2) {
                return { scans, repairPasses, replacements };
            }
            await waitTicks(PLACEMENT_STABILITY_CONFIRM_TICKS);
            continue;
        }
        consecutiveCleanScans = 0;
        if (repairPasses >= PLACEMENT_STABILITY_MAX_REPAIR_PASSES) {
            throw placementIntegrityError("placement integrity did not stabilize", result);
        }
        repairPasses += 1;
        for (let index = 0; index < result.failedGroups.length; index += 1) {
            await replacePlacementForStability(
                result.failedGroups[index].group, dimension, repairPasses, index
            );
            replacements += 1;
        }
        await waitTicks(PLACEMENT_STABILITY_CONFIRM_TICKS);
    }
    throw new Error("placement integrity loop ended unexpectedly");
}

async function smoothPlanStairs(
    plan,
    dimension,
    style,
    excludedPlacementIds = new Set(),
    guardLivePlayers = false
) {
    const selectedStyle = normalizeStairSmoothingStyle(style);
    const openedPoints = guardLivePlayers ? authoredOpeningPointKeys(plan) : new Set();
    const stairPlacements = createPlanStairSmoothingOperations(plan, selectedStyle)
        .filter((item) => !excludedPlacementIds.has(item.placement.placementId))
        .map((item) => ({...item, operations: item.operations.filter((operation) =>
            !openedPoints.has(pointKey(operation.worldPosition)))}));
    if (selectedStyle === STAIR_SMOOTHING_STYLE.AUTHORED) {
        return { style: selectedStyle, placements: 0, changed: 0, retained: 0, unexpected: 0 };
    }
    const expectedStairPlacements = plan.placements.filter(
        (placement) => placement.category === "stairs"
            && !excludedPlacementIds.has(placement.placementId)
    ).length;
    if (stairPlacements.length !== expectedStairPlacements) {
        throw new Error(
            `stair smoothing profile count ${stairPlacements.length} != planned stairs ${expectedStairPlacements}`
        );
    }
    if (stairPlacements.length === 0) {
        return { style: selectedStyle, placements: 0, changed: 0, retained: 0, unexpected: 0 };
    }

    const permutations = new Map();
    const retainedPositions = new Set();
    let changed = 0;
    let retained = 0;
    let settleRetries = 0;
    for (let index = 0; index < stairPlacements.length; index += 1) {
        const item = stairPlacements[index];
        await withLoadedBounds(
            dimension,
            placementBounds(item.placement),
            `ic_v3_smooth_${index}`,
            async () => {
                let pending = [];
                for (let attempt = 0; attempt < STAIR_SETTLE_ATTEMPTS; attempt += 1) {
                    pending = [];
                    for (const operation of item.operations) {
                        const block = dimension.getBlock(operation.worldPosition);
                        const typeId = block?.typeId ?? "missing";
                        const isRetainedLanding = operation.replaceTypes.length === 1
                            && typeId === "minecraft:oak_planks";
                        if (!isRetainedLanding && !operation.replaceTypes.includes(typeId)) {
                            pending.push({ typeId, position: operation.worldPosition });
                        }
                    }
                    if (pending.length === 0) break;
                    if (attempt + 1 < STAIR_SETTLE_ATTEMPTS) {
                        settleRetries += 1;
                        await waitTicks(STAIR_SETTLE_INTERVAL_TICKS);
                    }
                }
                if (pending.length > 0) {
                    const typeCounts = new Map();
                    for (const entry of pending) {
                        typeCounts.set(entry.typeId, (typeCounts.get(entry.typeId) ?? 0) + 1);
                    }
                    const types = [...typeCounts.entries()]
                        .map(([typeId, count]) => `${typeId}=${count}`)
                        .join(",");
                    const samples = pending.slice(0, 3)
                        .map((entry) => `${entry.typeId}@${pointKey(entry.position)}`)
                        .join(";");
                    throw new Error(
                        `stair ${item.placement.placementId} did not settle: `
                        + `remaining=${pending.length} types=${types} samples=${samples}`
                    );
                }
                for (let operationIndex = 0; operationIndex < item.operations.length; operationIndex += 1) {
                    const operation = item.operations[operationIndex];
                    if (guardLivePlayers && operationIndex % SMOOTHING_BATCH_SIZE === 0) {
                        await waitForLivePlayerClearance(
                            dimension,
                            placementBounds(item.placement),
                            `smooth:${item.placement.placementId}`
                        );
                    }
                    const block = dimension.getBlock(operation.worldPosition);
                    if (operation.replaceTypes.length === 1
                        && block?.typeId === "minecraft:oak_planks") {
                        retainedPositions.add(pointKey(operation.worldPosition));
                        retained += 1;
                        continue;
                    }
                    const permutationKey = `${operation.blockType}:${operation.states.weirdo_direction}`;
                    let permutation = permutations.get(permutationKey);
                    if (!permutation) {
                        permutation = BlockPermutation.resolve(operation.blockType, operation.states);
                        permutations.set(permutationKey, permutation);
                    }
                    block.setPermutation(permutation);
                    changed += 1;
                    if ((operationIndex + 1) % SMOOTHING_BATCH_SIZE === 0) await waitTicks(1);
                }
            }
        );
    }

    const verificationFailures = [];
    for (let index = 0; index < stairPlacements.length; index += 1) {
        const item = stairPlacements[index];
        await withLoadedBounds(
            dimension,
            placementBounds(item.placement),
            `ic_v3_smooth_verify_${index}`,
            async () => {
                for (const operation of item.operations) {
                    const key = pointKey(operation.worldPosition);
                    const expectedType = retainedPositions.has(key)
                        ? "minecraft:oak_planks"
                        : operation.blockType;
                    const actualType = dimension.getBlock(operation.worldPosition)?.typeId ?? "missing";
                    if (actualType !== expectedType && verificationFailures.length < 8) {
                        verificationFailures.push({ key, expectedType, actualType });
                    }
                }
                await waitTicks(1);
            }
        );
    }
    if (verificationFailures.length > 0) {
        const samples = verificationFailures
            .slice(0, 3)
            .map((entry) => `${entry.actualType}->${entry.expectedType}@${entry.key}`)
            .join(";");
        throw new Error(`stair smoothing verification failed: ${samples}`);
    }
    return {
        style: selectedStyle,
        placements: stairPlacements.length,
        changed,
        retained,
        unexpected: 0,
        settleRetries,
    };
}

async function prepareStablePlanGeometry(
    plan,
    dimension,
    stairSmoothingStyle,
    player,
    excludedPlacementIds = new Set()
) {
    safeSendMessage(player, "[ic-rebuild] integrity map: preparing");
    await waitTicks(1);
    const integrityGroups = createPlanPlacementIntegrityGroups(plan)
        .filter((group) => !excludedPlacementIds.has(group.placement.placementId));
    const probes = countPlanPlacementIntegrityProbes(integrityGroups);
    safeSendMessage(player,
        `[ic-rebuild] integrity map: ready groups=${integrityGroups.length} probes=${probes}`
    );
    let scans = 0;
    let repairPasses = 0;
    let replacements = 0;
    let smoothing = null;
    for (let cycle = 1; cycle <= GEOMETRY_MAX_CYCLES; cycle += 1) {
        const stability = await stabilizePlanPlacements(plan, dimension, integrityGroups);
        scans += stability.scans;
        repairPasses += stability.repairPasses;
        replacements += stability.replacements;
        smoothing = await smoothPlanStairs(
            plan, dimension, stairSmoothingStyle, excludedPlacementIds
        );

        // StructureManager.place has no completion promise.  Hold a quiet window
        // after smoothing, then prove every authored navigation/support target is
        // still intact before any irreversible seam carving starts.
        await waitTicks(PLACEMENT_STABILITY_CONFIRM_TICKS);
        const postflight = await inspectPlanPlacementIntegrity(
            integrityGroups,
            dimension,
            `post_${cycle}`,
            stairSmoothingStyle === STAIR_SMOOTHING_STYLE.AUTHORED
                ? "authored"
                : "smoothed"
        );
        scans += 1;
        if (postflight.failures === 0) {
            return {
                smoothing,
                probes,
                scans,
                repairPasses,
                replacements,
                cycles: cycle,
            };
        }
        if (cycle === GEOMETRY_MAX_CYCLES) {
            throw placementIntegrityError("post-smoothing integrity did not stabilize", postflight);
        }
        // The next cycle's read-only preflight identifies the owning structures,
        // replaces only those assets, and then reapplies deterministic smoothing.
    }
    throw new Error("geometry preparation loop ended unexpectedly");
}

function authoredOpeningPointKeys(plan) {
    const openedPoints = new Set();
    for (const connection of plan.connections ?? []) {
        for (const point of [...(connection.fromCarve ?? []), ...(connection.toCarve ?? []),
            ...createConnectionClearance(connection).air]) openedPoints.add(pointKey(point));
    }
    return openedPoints;
}

function createDynamicPlanIntegrityGroups(plan, excludedPlacementIds) {
    const openedPoints = authoredOpeningPointKeys(plan);
    // Wave placement opens completed links before the final structure scan.
    // Authored wall probes there must not classify intentional doorways as a
    // failed placement and rebuild an occupied, newly opened room over them.
    return createPlanPlacementIntegrityGroups(plan)
        .filter((group) => !excludedPlacementIds.has(group.placement.placementId))
        .map((group) => ({...group, probes: group.probes.filter((probe) =>
            !openedPoints.has(pointKey(probe.position)))}));
}

async function prepareFastDynamicPlanGeometry(
    plan,
    dimension,
    stairSmoothingStyle,
    excludedPlacementIds = new Set()
) {
    const integrityGroups = createDynamicPlanIntegrityGroups(plan, excludedPlacementIds);
    const probes = countPlanPlacementIntegrityProbes(integrityGroups);
    let scans = 1;
    let repairPasses = 0;
    let replacements = 0;

    // One authored preflight is enough for the short-settle dynamic path.  Only
    // failed structures pay the cost of a second placement.
    const preflight = await inspectPlanPlacementIntegrity(
        integrityGroups, dimension, "dyn_pre", "authored"
    );
    if (preflight.failures > 0) {
        repairPasses += 1;
        for (let index = 0; index < preflight.failedGroups.length; index += 1) {
            await replacePlacementForStability(
                preflight.failedGroups[index].group,
                dimension,
                repairPasses,
                index,
                true
            );
            replacements += 1;
        }
    }

    let smoothing = await smoothPlanStairs(
        plan, dimension, stairSmoothingStyle, excludedPlacementIds, true
    );
    await waitTicks(DYNAMIC_VERIFY_SETTLE_TICKS);
    let postflight = await inspectPlanPlacementIntegrity(
        integrityGroups,
        dimension,
        "dyn_post_1",
        stairSmoothingStyle === STAIR_SMOOTHING_STYLE.AUTHORED ? "authored" : "smoothed"
    );
    scans += 1;
    if (postflight.failures > 0) {
        repairPasses += 1;
        for (let index = 0; index < postflight.failedGroups.length; index += 1) {
            await replacePlacementForStability(
                postflight.failedGroups[index].group,
                dimension,
                repairPasses,
                index,
                true
            );
            replacements += 1;
        }
        smoothing = await smoothPlanStairs(
            plan, dimension, stairSmoothingStyle, excludedPlacementIds, true
        );
        await waitTicks(DYNAMIC_VERIFY_SETTLE_TICKS);
        postflight = await inspectPlanPlacementIntegrity(
            integrityGroups,
            dimension,
            "dyn_post_2",
            stairSmoothingStyle === STAIR_SMOOTHING_STYLE.AUTHORED ? "authored" : "smoothed"
        );
        scans += 1;
    }
    if (postflight.failures > 0) {
        throw placementIntegrityError("fast dynamic integrity did not stabilize", postflight);
    }
    return {
        smoothing,
        probes,
        scans,
        repairPasses,
        replacements,
        cycles: 1,
    };
}

function isAir(block) {
    return block?.isAir === true || block?.typeId === "minecraft:air";
}

function isUnsupportedWalkSurface(block) {
    const typeId = block?.typeId;
    return !block
        || isAir(block)
        || block.isLiquid === true
        || typeId === "minecraft:water"
        || typeId === "minecraft:flowing_water"
        || typeId === "minecraft:lava"
        || typeId === "minecraft:flowing_lava";
}

function seamDistance(left, right) {
    return Math.abs(left.x - right.x) + Math.abs(left.y - right.y) + Math.abs(left.z - right.z);
}

async function openAuthoredSeam(dimension, connection, index, guardLivePlayers = false) {
    if (connection.mode !== "authored_seam") {
        throw new Error(`unsupported connection mode: ${connection.mode ?? "missing"}`);
    }
    const clearance = createConnectionClearance(connection);
    const carveByKey = new Map();
    for (const point of [
        ...connection.fromCarve,
        ...connection.toCarve,
        ...clearance.air,
    ]) {
        carveByKey.set(pointKey(point), point);
    }
    const carvePoints = [...carveByKey.values()];
    const bounds = connectionBounds(connection);
    await withLoadedBounds(dimension, bounds, `ic_v3_seam_${index}`, async () => {
        if (guardLivePlayers) {
            await waitForLivePlayerClearance(dimension, bounds, `seam:${index}`);
        }
        for (const point of carvePoints) dimension.setBlockType(point, "minecraft:air");
        await waitTicks(1);

        const blocked = [];
        const unsupported = [];
        const stairSupports = new Map(clearance.stairSupports.map(support => [pointKey(support.position), support]));
        const floorNormal = directionVector(connection.floorNormal);
        for (let laneIndex = 0; laneIndex < connection.fromLanes.length; laneIndex += 1) {
            const from = connection.fromLanes[laneIndex];
            const to = connection.toLanes[laneIndex];
            if (seamDistance(from, to) !== 1) {
                throw new Error(`seam ${index} lane ${laneIndex} is not adjacent`);
            }
            for (const lane of [from, to]) {
                for (let height = 0; height < Math.min(SEAM_CLEARANCE, connection.opening.height); height += 1) {
                    const point = addScaled(lane, floorNormal, height);
                    const block = dimension.getBlock(point);
                    if (!isAir(block)) blocked.push(`${pointKey(point)}=${block?.typeId ?? "unloaded"}`);
                }
            }
        }
        for (const point of carvePoints) {
            const block = dimension.getBlock(point);
            if (!isAir(block)) blocked.push(`${pointKey(point)}=${block?.typeId ?? "unloaded"}`);
        }
        // A missing block directly below the doorway would technically be open
        // but not traversable. Repair only this authored socket footprint.
        if (guardLivePlayers) {
            await waitForLivePlayerClearance(dimension, bounds, `seam-support:${index}`);
        }
        for (const supportPoint of clearance.supports) {
            const support = dimension.getBlock(supportPoint);
            const stair = stairSupports.get(pointKey(supportPoint));
            if (stair && (!stair.retainLanding || support?.typeId === "minecraft:oak_stairs")) {
                if (!support) throw new Error(`stair socket support is unloaded: ${pointKey(supportPoint)}`);
                if (isUnsupportedWalkSurface(support) || ["minecraft:oak_planks", "minecraft:oak_stairs", "minecraft:oak_fence"].includes(support.typeId)) {
                    // Repairs the known legacy flat-carve damage without
                    // replacing the occupied stair or the neighbouring room.
                    support.setPermutation(BlockPermutation.resolve("minecraft:oak_stairs", stair.states));
                }
            } else if (isUnsupportedWalkSurface(support)) {
                dimension.setBlockType(supportPoint, "minecraft:oak_planks");
            }
            const repaired = dimension.getBlock(supportPoint);
            if (isUnsupportedWalkSurface(repaired)) {
                unsupported.push(`${pointKey(supportPoint)}=${repaired?.typeId ?? "unloaded"}`);
            }
        }
        if (blocked.length > 0) {
            throw new Error(`seam ${index} remained blocked: ${blocked.slice(0, 8).join(", ")}`);
        }
        if (unsupported.length > 0) {
            throw new Error(`seam ${index} has no walk support: ${unsupported.slice(0, 8).join(", ")}`);
        }
    });
    return carvePoints.length;
}

function addPoints(origin, points) {
    return points.map((point) => ({
        x: origin.x + point.x,
        y: origin.y + point.y,
        z: origin.z + point.z,
    }));
}

async function sealUnusedAuthoredSockets(
    plan,
    dimension,
    excludedPlacementIds = new Set(),
    guardLivePlayers = false
) {
    const sealedSockets = Array.isArray(plan?.sealedSockets) ? plan.sealedSockets : [];
    if (sealedSockets.length === 0) return { sockets: 0, placed: 0, retained: 0 };
    const placementsById = new Map(plan.placements.map((placement) => [
        placement.placementId,
        placement,
    ]));
    const activeOpeningPoints = new Set((plan.connections ?? []).flatMap((connection) => {
        const clearance = createConnectionClearance(connection);
        return [...(connection.fromCarve ?? []), ...(connection.toCarve ?? []),
            ...(connection.fromLanes ?? []), ...(connection.toLanes ?? []),
            ...clearance.air].map(pointKey);
    }));
    let sockets = 0;
    let placed = 0;
    let retained = 0;
    for (let index = 0; index < sealedSockets.length; index += 1) {
        const sealed = sealedSockets[index];
        const placement = placementsById.get(sealed.placementId);
        if (!placement) throw new Error(`sealed socket references missing placement ${sealed.placementId}`);
        if (excludedPlacementIds.has(placement.placementId)) continue;
        sockets += 1;
        const allLanes = addPoints(placement.origin, sealed.localWalkLanes ?? []);
        if (allLanes.length < 5) throw new Error(`sealed socket ${sealed.placementId} is narrower than 5`);
        const lanes = allLanes.filter((point) => !activeOpeningPoints.has(pointKey(point)));
        if (lanes.length === 0) continue;
        await withLoadedBounds(
            dimension,
            placementBounds(placement),
            `ic_v3_cap_${index}`,
            async () => {
                if (guardLivePlayers) {
                    await waitForLivePlayerClearance(
                        dimension,
                        tightBoundsForPoints(lanes),
                        `cap:${placement.placementId}`
                    );
                }
                for (const point of lanes) {
                    const block = dimension.getBlock(point);
                    if (!block) throw new Error(`sealed socket block is unloaded at ${pointKey(point)}`);
                    if (isAir(block) || block.typeId.endsWith("_stairs")
                        || block.typeId.endsWith("_slab")) {
                        dimension.setBlockType(point, "minecraft:oak_fence");
                        placed += 1;
                    } else if (block.typeId === "minecraft:oak_fence") {
                        retained += 1;
                    } else {
                        // An existing solid wall already closes an unused
                        // socket. Do not abort the connected doorway pass.
                        retained += 1;
                    }
                    const result = dimension.getBlock(point);
                    if (!result || isAir(result)) {
                        throw new Error(`sealed socket remained open at ${pointKey(point)}`);
                    }
                }
                await waitTicks(1);
            }
        );
    }
    return { sockets, placed, retained };
}

export async function rebuildSourcePartsV2(player, rawOptions = "", target = undefined) {
    if (!player) return { ok: false, reason: "missing_player" };
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) {
        safeSendMessage(player, "[infinite_castle] 素材建築の再構築はすでに進行中です");
        return { ok: false, reason: "busy" };
    }
    reconstructionInProgress = true;
    let visualTestStarted = false;
    try {
        const options = parseSourcePartsRebuildOptions(rawOptions);
        const stairSmoothingStyle = normalizeStairSmoothingStyle(
            options.stairSmoothingStyle ?? DEFAULT_STAIR_SMOOTHING_STYLE
        );
        let seed = options.seed ?? (Date.now() >>> 0);
        const dimension = target?.dimension ?? player.dimension;
        const startLocation = { ...(target?.startLocation ?? player.location) };
        if (!dimension || !validPoint(startLocation)) {
            throw new Error("rebuild target dimension/location is invalid");
        }
        const playStartCue = createRebuildStartCue(dimension);
        let previous = null;
        if (target?.visualTest) {
            beginVisualTest(dimension);
            visualTestStarted = true;
            previous = restoreDetailedPlan(dimension);
            if (previous?.seed === seed) seed = (seed + 1) >>> 0;
        }
        const anchor = previous?.tierBases?.lower ?? {
            x: Math.floor(startLocation.x / 16) * 16 + 128,
            y: Math.max(64, Math.floor(startLocation.y)),
            z: Math.floor(startLocation.z / 16) * 16,
        };
        const style = previous?.style ?? options.style;
        const alternatives = target?.visualTest
            ? sourcePartsTopologyIds().filter((id) => id.startsWith(`${style}_`) && id !== previous?.topologyId)
            : [];
        const plan = createSourcePartsPlan(seed, anchor, {
            style, ...(alternatives.length ? {topology: alternatives[seed % alternatives.length]} : {}),
        });
        plan.dimensionId = dimension.id;
        const heightFit = fitPlanToHeightRange(plan, dimension.heightRange);
        const storedPlans = loadStoredPlans();
        if (target?.visualTest && storedPlans.some((stored) => stored.dimensionId !== dimension.id)) {
            throw new Error("別ディメンションの保存済み建築があるため総入れ替えを停止しました");
        }

        const packIds = world.structureManager.getPackStructureIds();
        const missing = plan.placements.filter((placement) =>
            !resolveStructureId(placement.variantId, packIds)
        );
        if (missing.length > 0) {
            throw new Error(`missing generated variants: ${missing.map((item) => item.variantId).join(", ")}`);
        }

        let preparedScenery;
        const sceneryDensity = getSourcePartsSceneryStatus().density;
        if (target?.visualTest) {
            safeSendMessage(player, "[infinite_castle] 総入れ替えの攻略棟・装飾棟を事前計画中です");
            preparedScenery = await createSourcePartsSceneryPlanAsync(plan, {
                seed: (seed ^ 0x51ce4e7) >>> 0,
                density: sceneryDensity === "dense" ? "dense" : "default",
                heightRange: dimension.heightRange,
            }, () => waitTicks(1));
            preparedScenery.dimensionId = dimension.id;
            if (preparedScenery.placements.some((placement) => !resolveStructureId(placement.variantId, packIds))) {
                throw new Error("総入れ替えに必要な装飾素材が登録されていません");
            }
            assertVisualTestSafety(dimension);
            playStartCue();
            deactivateSourcePartsDemo();
            const cleared = await clearSourcePartsScenery(player, dimension);
            if (!cleared?.ok) throw new Error(`装飾の全消去に失敗: ${cleared?.error ?? cleared?.reason}`);
        }

        // A manually re-anchored full rebuild can otherwise enter the persisted
        // decorative shell. Resolve that risk before touching any core blocks.
        if (dimension.id === SCENERY_DIMENSION_ID) {
            const sceneryPreparation = await prepareSourcePartsSceneryForCore(
                plan, dimension, player
            );
            if (!sceneryPreparation?.ok) {
                throw new Error(
                    `decorative scenery is busy: ${sceneryPreparation?.reason ?? "unknown"}`
                );
            }
        }

        safeSendMessage(player,
            `[infinite_castle] ${plan.placements.length}棟の${options.style}計画を生成 `
            + `seed=${seed} attempt=${plan.attempt + 1}/${plan.attemptLimit} yShift=${heightFit.shiftY}`
        );
        playStartCue();
        deactivateSourcePartsDemo();
        // Keep only the already-persisted plans while clearing. If the script stops
        // here, the next run safely clears the same regions again; the new plan is
        // persisted immediately before its first structure is placed.
        saveReconstructionState("clearing", storedPlans);
        await clearStoredPlans(storedPlans, player);
        clearLegacyReconstructionState();
        saveReconstructionState("building", [plan]);
        await placePlan(plan, player, dimension, startLocation);
        const geometry = await prepareStablePlanGeometry(
            plan, dimension, stairSmoothingStyle, player
        );
        const smoothing = geometry.smoothing;
        safeSendMessage(player,
            `[ic-rebuild] stairStyle=${smoothing.style} stairParts=${smoothing.placements} `
            + `changed=${smoothing.changed} retained=${smoothing.retained} `
            + `unexpected=${smoothing.unexpected} settleRetries=${smoothing.settleRetries ?? 0}`
        );
        safeSendMessage(player,
            `[ic-rebuild] integrityProbes=${geometry.probes} scans=${geometry.scans} `
            + `repairPasses=${geometry.repairPasses} replacements=${geometry.replacements} `
            + `geometryCycles=${geometry.cycles}`
        );
        // Seal dead ends first. Connected authored openings are carved last so
        // a cap can never win over a usable room/corridor entrance.
        const caps = await sealUnusedAuthoredSockets(plan, dimension);
        let carvedBlocks = 0;
        for (let index = 0; index < plan.connections.length; index += 1) {
            carvedBlocks += await openAuthoredSeam(dimension, plan.connections[index], index);
        }
        // Publish the detailed restore target before the terminal compact
        // marker, matching the dynamic path's crash-consistent commit order.
        saveDetailedPlan(plan);
        saveReconstructionState("complete", [plan]);
        const demo = activateSourcePartsDemo(plan);
        // Decorative pieces are deliberately outside plan.placements, so none
        // of the route validation, cap, seam, or progression systems can use them.
        const scenery = dimension.id === SCENERY_DIMENSION_ID
            ? await ensureSourcePartsScenery(plan, dimension, player, target?.visualTest
                ? {force:true, density:preparedScenery.density, preparedPlan:preparedScenery, startCue:false}
                : {startCue:false})
            : { ok: true, skipped: "non_dungeon_dimension" };
        if (target?.visualTest && (!scenery.ok || scenery.partial || scenery.skipped > 0)) {
            throw new Error(`攻略棟は完成しましたが装飾が未完了です。総入れ替えを再実行してください: ${scenery.error ?? scenery.reason ?? "partial"}`);
        }
        safeSendMessage(player,
            `[ic-rebuild] seams=${plan.connections.length} carved=${carvedBlocks} fillers=0`
        );
        safeSendMessage(player,
            `[ic-rebuild] oakCaps=${caps.sockets} fenceBlocks=${caps.placed} retained=${caps.retained}`
        );
        safeSendMessage(player,
            `[ic-layout] rooms=${demo.rooms} stateBytes=${demo.serializedLength} `
            + `progression=off entranceExit=on`
        );
        safeSendMessage(player,
            `[infinite_castle] 再構築完了 buildings=${plan.placements.length} connections=${plan.connections.length}`
        );
        return { ok: true, plan, demo, scenery };
    } catch (error) {
        console.warn(`[infinite_castle] source reconstruction v3 failed: ${error?.stack ?? error}`);
        safeSendMessage(player, `[infinite_castle] 素材建築の再構築失敗: ${error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        if (visualTestStarted) endVisualTest();
        reconstructionInProgress = false;
    }
}

export function rebuildAllSourcePartsForVisualTest(player) {
    if (player?.dimension?.id !== SCENERY_DIMENSION_ID) {
        safeSendMessage(player, "[infinite_castle] 総入れ替えは無限城内で実行してください");
        return Promise.resolve({ok:false, reason:"dimension"});
    }
    return rebuildSourcePartsV2(player, "", {
        dimension:player.dimension, startLocation:{x:1000,y:80,z:1000}, visualTest:true,
    });
}

export function rebuildSourcePartsAt(player, dimension, startLocation, rawOptions = "") {
    return rebuildSourcePartsV2(player, rawOptions, { dimension, startLocation });
}

function messagePlayers(players, message) {
    for (const player of players) safeSendMessage(player, message);
}

export function isSourcePartsReconstructionInProgress() {
    return reconstructionInProgress || isSourcePartsSceneryInProgress();
}

export async function selectSafeDynamicCandidate(
    oldPlan,
    anchorLocations,
    requestedSeed,
    heightRange,
    options = {}
) {
    // restoreDetailedPlan also runs the planner.  Separate that work from the
    // anchored candidate search so neither accumulates in one watchdog tick.
    await waitTicks(1);
    const failures = [];
    for (let attempt = 0; attempt < DYNAMIC_CANDIDATE_ATTEMPTS; attempt += 1) {
        const candidateSeed = (
            (requestedSeed >>> 0) + Math.imul(attempt, DYNAMIC_SEED_STEP)
        ) >>> 0;
        try {
            const anchored = await createAnchoredSourcePartsReconstructionAsync(
                oldPlan,
                anchorLocations,
                candidateSeed,
                heightRange,
                DYNAMIC_PROTECTION_HOPS,
                options,
                () => waitTicks(1)
            );
            // Start ticking-area/block work on a fresh tick as well.
            await waitTicks(1);
            return {
                ...anchored,
                requestedSeed: requestedSeed >>> 0,
                selectedSeed: candidateSeed,
                candidateAttempts: attempt + 1,
                stationaryFallback: false,
            };
        } catch (error) {
            failures.push(error);
            // Planner search is CPU-heavy.  Never run another complete layout
            // search in the same Bedrock tick or the script watchdog can treat
            // the combined work as a server hang.
            await waitTicks(1);
        }
    }

    // Exact preservation can be over-constrained by players occupying distant
    // tiers. Rebuild every safe mutable structure at the existing coordinates
    // instead of skipping the cycle; a later interval retries a moving layout.
    const stationary = createStationarySourcePartsReconstruction(
        oldPlan,
        anchorLocations,
        DYNAMIC_PROTECTION_HOPS,
        options
    );
    return {
        ...stationary,
        requestedSeed: requestedSeed >>> 0,
        selectedSeed: oldPlan.seed >>> 0,
        candidateAttempts: DYNAMIC_CANDIDATE_ATTEMPTS,
        stationaryFallback: true,
        candidateFailures: failures.length,
    };
}

export async function reconstructSourcePartsAroundPlayers(
    dimension,
    seed = Date.now() >>> 0
) {
    if (!dimension) return { ok: false, reason: "missing_dimension" };
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) {
        return { ok: false, reason: "busy" };
    }
    const players = dimension.getPlayers();
    if (players.length === 0) return { ok: false, reason: "no_players" };

    reconstructionInProgress = true;
    let oldPlan = null;
    let dynamicMutationStarted = false;
    const startedAt = Date.now();
    const timings = {};
    try {
        messagePlayers(players, "[ic-rebuild] 在室・隣接棟を保護して配置を計画中です");
        oldPlan = restoreDetailedPlan(dimension);
        if (!oldPlan) throw new Error("current source-parts plan could not be restored");
        const storedPlans = loadStoredPlans();
        const stateStatus = loadReconstructionStateStatus();
        const baselineSignature = recoveryPlanGeometrySignature(oldPlan);
        const recoveryPending = interruptedDynamicStatus(stateStatus)
            || storedPlans.some((plan) =>
                recoveryPlanGeometrySignature(plan) !== baselineSignature
            );
        // A non-terminal compact state means the baseline may already contain
        // holes even before this invocation starts. Never advertise it as an
        // intact runtime from the outer catch path until recovery resynchronizes it.
        if (recoveryPending) dynamicMutationStarted = true;
        const sceneryGuard = getSourcePartsSceneryGuard(dimension.id);
        if (!sceneryGuard.known) {
            const error = new Error(
                "stored decorative scenery state is invalid; dynamic rebuild was not started"
            );
            error.code = "SCENERY_STATE_INVALID";
            throw error;
        }
        const playerLocations = players.map((player) => player.location);
        const playerZones = classifySourcePlayerLocations(
            oldPlan,
            playerLocations,
            sceneryGuard.bounds
        );
        if (playerZones.conflict.length > 0 || playerZones.invalid.length > 0) {
            const reason = playerZones.conflict.length > 0
                ? "player_location_conflict"
                : "invalid_player_location";
            messagePlayers(
                players,
                "[infinite_castle] プレイヤー位置の安全判定が矛盾したため、ブロック変更前に停止しました"
            );
            return { ok: false, reason };
        }
        const playerSafetyBounds = playerLocations
            .map((location) => sourcePlayerSafetyBounds(location))
            .filter(Boolean);
        const sceneryRelocationGuard = getSourcePartsSceneryRelocationGuard(
            dimension,
            playerSafetyBounds
        );
        if (!sceneryRelocationGuard.known) {
            const error = new Error(
                "stored decorative scenery state is invalid; dynamic rebuild was not started"
            );
            error.code = "SCENERY_STATE_INVALID";
            throw error;
        }
        const requiredOldPlacementIds = sourcePlacementsIntersectingBounds(
            oldPlan,
            playerSafetyBounds
        ).map((placement) => placement.placementId);
        const anchored = await selectSafeDynamicCandidate(
            oldPlan,
            playerZones.anchorLocations,
            seed >>> 0,
            dimension.heightRange,
            {
                // Only scenery which currently protects a player is fixed.
                // Every other decorative building may be safely evacuated once
                // a high-change playable layout has been selected.
                sceneryExclusionBounds: sceneryRelocationGuard.fixedBounds,
                sceneryExclusionClearance: SCENERY_CORE_CLEARANCE,
                playerExclusionBounds: playerSafetyBounds,
                requiredOldPlacementIds,
            }
        );
        const plan = anchored.plan;
        timings.planningMs = Date.now() - startedAt;
        messagePlayers(players, `[ic-rebuild] 計画完了 ${(timings.planningMs / 1000).toFixed(1)}秒。安全確認・装飾退避中です`);
        const protectedNewIds = new Set(anchored.protectedNewPlacementIds);
        const packIds = world.structureManager.getPackStructureIds();
        const missing = plan.placements.filter((placement) =>
            !resolveStructureId(placement.variantId, packIds)
        );
        if (missing.length > 0) {
            throw new Error(`missing generated variants: ${missing.map((item) => item.variantId).join(", ")}`);
        }

        const preparationStartedAt = Date.now();
        const recovery = await recoverInterruptedDynamicState(
            oldPlan,
            storedPlans,
            stateStatus,
            anchored.protectedOldPlacementIds,
            players,
            dimension,
            playerSafetyBounds
        );
        if (!recovery?.ok) {
            messagePlayers(
                players,
                "[infinite_castle] 中断状態の安全復旧を待機します。表示された区画から離れると再試行できます"
            );
            return {
                ok: false,
                reason: recovery?.reason ?? "recovery_pending",
                recovery,
            };
        }

        const sceneryRelocation = await prepareSourcePartsSceneryForDynamicCore(
            plan,
            dimension,
            players[0],
            {
                clearance: SCENERY_CORE_CLEARANCE,
                playerSafetyBounds,
            }
        );
        if (!sceneryRelocation?.ok) {
            messagePlayers(
                players,
                "[infinite_castle] 装飾城郭の安全区画を通過中のため、攻略城の再構築を今回は待機します"
            );
            return {
                ok: false,
                reason: sceneryRelocation?.reason ?? "scenery_relocation",
                scenery: sceneryRelocation,
            };
        }

        timings.preparationMs = Date.now() - preparationStartedAt;
        createRebuildStartCue(dimension)();
        const waveStartedAt = Date.now();
        messagePlayers(
            players,
            `[infinite_castle] 部分再構築開始 seed=${anchored.selectedSeed} `
            + `anchor=${playerZones.anchorMode} `
            + `protected=${anchored.protectedOldPlacementIds.length} `
            + `changed=${anchored.changedPlacements}/${plan.placements.length} `
            + `attempts=${anchored.candidateAttempts} `
            + `fallback=${anchored.stationaryFallback ? "stationary" : "moved"} `
            + `sceneryEvacuated=${sceneryRelocation.evacuated ?? 0} `
            + `recovered=${recovery.required ? recovery.plans : 0}`
        );
        deactivateSourcePartsDemo();
        // Persist both physical envelopes before touching blocks.  A manual
        // recovery rebuild can therefore clear either side after interruption.
        saveReconstructionState("dynamic_rebuilding", [oldPlan, plan]);
        dynamicMutationStarted = true;
        const phased = await runPhasedDynamicRebuild(
            oldPlan,
            plan,
            anchored.protectedOldPlacementIds,
            anchored.protectedNewPlacementIds,
            players,
            dimension
        );
        const clearedRegions = phased.clearedRegions;
        const placed = phased.placed;
        timings.waveMs = Date.now() - waveStartedAt;
        const finishingStartedAt = Date.now();
        messagePlayers(players, "[ic-rebuild] 配置完了。階段と全38接続の出入口を検証・修復中です");
        const geometry = await prepareFastDynamicPlanGeometry(
            plan,
            dimension,
            DEFAULT_STAIR_SMOOTHING_STYLE,
            protectedNewIds
        );
        const caps = await sealUnusedAuthoredSockets(
            plan,
            dimension,
            protectedNewIds,
            true
        );
        let carvedBlocks = 0;
        let retainedSeams = 0;
        const oldConnectionSignatures = new Set(
            oldPlan.connections.map(dynamicConnectionWorldSignature)
        );
        for (let index = 0; index < plan.connections.length; index += 1) {
            const connection = plan.connections[index];
            if (protectedNewIds.has(connection.fromPlacementId)
                && protectedNewIds.has(connection.toPlacementId)
                && oldConnectionSignatures.has(
                    dynamicConnectionWorldSignature(connection)
                )) {
                retainedSeams += 1;
                // The protected building may carry a fence from an earlier
                // interrupted wave. Revalidate its opening too.
            }
            carvedBlocks += await openAuthoredSeam(dimension, connection, index, true);
        }
        // Publish the full descriptor before changing the compact state to its
        // terminal marker.  A crash can therefore never advertise "complete"
        // while restoreDetailedPlan still points at the old physical layout.
        saveDetailedPlan(plan);
        saveReconstructionState("complete", [plan]);
        activateSourcePartsDemo(plan);
        // Decoration has its own lower-priority clock. Only conflict evacuation
        // is mandatory here; replenishing all 36 pieces would delay core play.
        const scenery = {ok:true, deferred:true, reason:"independent_timer"};
        timings.finishingMs = Date.now() - finishingStartedAt;
        timings.totalMs = Date.now() - startedAt;
        console.warn(`[ic-rebuild-profile] ${JSON.stringify(timings)}`);
        messagePlayers(
            players,
            `[infinite_castle] 部分再構築完了 protected=${protectedNewIds.size} `
            + `placed=${placed} clearedRegions=${clearedRegions} seams=${plan.connections.length} `
            + `retainedSeams=${retainedSeams} `
            + `carved=${carvedBlocks} caps=${caps.sockets} repairs=${geometry.replacements} `
            + `transitionCaps=${phased.transitionCaps.placed} `
            + `scenery=${scenery?.deferred ? "deferred" : (scenery?.ok ? "rebuilt" : "pending")}`
        );
        return {
            ok: true,
            seed: anchored.selectedSeed,
            plan,
            protectedPlacements: protectedNewIds.size,
            changedPlacements: anchored.changedPlacements,
            anchorMode: playerZones.anchorMode,
            corePlayers: playerZones.core.length,
            sceneryPlayers: playerZones.scenery.length,
            outsidePlayers: playerZones.outside.length,
            candidateAttempts: anchored.candidateAttempts,
            stationaryFallback: anchored.stationaryFallback,
            placed,
            scenery,
            recovery,
            timings,
        };
    } catch (error) {
        console.warn(`[infinite_castle] anchored source reconstruction failed: ${error?.stack ?? error}`);
        if (oldPlan && !dynamicMutationStarted) {
            try {
                activateSourcePartsDemo(oldPlan);
            } catch {
                // Keep the physically protected room even if runtime recovery fails.
            }
        }
        if (error?.code === "SCENERY_GUARD") {
            messagePlayers(
                players,
                "[infinite_castle] 装飾城郭との安全距離を保てる配置がないため、今回は再構築を見送りました"
            );
            return { ok: false, reason: "scenery_guard", error: String(error) };
        }
        if (error?.code === "SCENERY_STATE_INVALID") {
            messagePlayers(
                players,
                "[infinite_castle] 装飾城郭の保存状態を確認できないため、安全のため再構築を見送りました"
            );
            return { ok: false, reason: "scenery_state_invalid", error: String(error) };
        }
        messagePlayers(players, `[infinite_castle] 部分再構築失敗: ${error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        reconstructionInProgress = false;
    }
}

export async function repairSourcePartsOpenings(player) {
    if (!player) return { ok: false, reason: "missing_player" };
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) {
        safeSendMessage(player, "[infinite_castle] 再構築処理中のため、出入口修復は待機してください");
        return { ok: false, reason: "busy" };
    }
    // The old descriptor is not necessarily the physical castle after a crash.
    // The reconstruction path owns residual recovery and will reopen its routes.
    if (interruptedDynamicStatus(loadReconstructionStateStatus())) {
        return reconstructSourcePartsAroundPlayers(player.dimension);
    }
    reconstructionInProgress = true;
    try {
        const dimension = player.dimension;
        const plan = restoreDetailedPlan(dimension);
        if (!plan) throw new Error("current source-parts plan could not be restored");
        let carvedBlocks = 0;
        for (let index = 0; index < plan.connections.length; index += 1) {
            carvedBlocks += await openAuthoredSeam(dimension, plan.connections[index], index, true);
        }
        safeSendMessage(
            player,
            `[infinite_castle] 出入口修復完了 connections=${plan.connections.length} cleared=${carvedBlocks}`
        );
        return { ok: true, connections: plan.connections.length, carvedBlocks };
    } catch (error) {
        console.warn(`[infinite_castle] source-parts opening repair failed: ${error?.stack ?? error}`);
        safeSendMessage(player, `[infinite_castle] 出入口修復失敗: ${error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        reconstructionInProgress = false;
    }
}

export async function updateSourcePartsScenery(dimension, options = {}) {
    if (dimension?.id !== SCENERY_DIMENSION_ID) return {ok:false, reason:"dimension"};
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) return {ok:false, reason:"busy"};
    if (loadReconstructionStateStatus() !== "complete") return {ok:false, reason:"core_incomplete"};
    const players = dimension.getPlayers();
    if (players.length === 0) return {ok:false, reason:"no_players"};
    reconstructionInProgress = true;
    try {
        await waitTicks(1);
        const plan = restoreDetailedPlan(dimension);
        if (!plan) return {ok:false, reason:"missing_core"};
        return await rebuildSourcePartsSceneryCluster(plan, dimension, players[0], options);
    } finally {
        reconstructionInProgress = false;
    }
}

export async function clearSourcePartsV2(player, rawOptions = "") {
    if (!player) return;
    if (String(rawOptions ?? "").trim().toLowerCase() !== "confirm") {
        safeSendMessage(
            player,
            "[infinite_castle] 消去するには /scriptevent infinite_castle:clear_source_parts confirm"
        );
        safeSendMessage(
            player,
            "[infinite_castle] 注意: 保存された素材建築範囲内の後置きブロックも消去されます"
        );
        return;
    }
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) {
        safeSendMessage(player, "[infinite_castle] 素材建築の処理はすでに進行中です");
        return;
    }

    reconstructionInProgress = true;
    try {
        const storedPlans = loadStoredPlans();
        const sceneryClear = await clearSourcePartsScenery(player);
        if (!sceneryClear?.ok) {
            throw new Error(
                `decorative scenery could not be cleared: ${sceneryClear?.reason ?? "unknown"}`
            );
        }
        deactivateSourcePartsDemo();
        if (storedPlans.length === 0) {
            saveReconstructionState("empty", []);
            world.setDynamicProperty(DETAILED_PLAN_KEY, undefined);
            clearLegacyReconstructionState();
            safeSendMessage(
                player,
                `[infinite_castle] 攻略用建築はありません（装飾=${sceneryClear.placements ?? 0}棟消去）`
            );
            return;
        }

        // Persist every still-known plan before touching blocks.  If the job is
        // interrupted, the next clear/rebuild safely retries the same volumes.
        saveReconstructionState("clearing", storedPlans);
        safeSendMessage(
            player,
            `[infinite_castle] 素材建築の消去を開始します plans=${storedPlans.length}`
        );
        const clearedRegions = await clearStoredPlans(storedPlans, player);
        saveReconstructionState("empty", []);
        world.setDynamicProperty(DETAILED_PLAN_KEY, undefined);
        clearLegacyReconstructionState();
        safeSendMessage(
            player,
            `[infinite_castle] 素材建築の消去完了 plans=${storedPlans.length} `
            + `regions=${clearedRegions} scenery=${sceneryClear.placements ?? 0}`
        );
    } catch (error) {
        console.warn(`[infinite_castle] source-parts clear failed: ${error?.stack ?? error}`);
        safeSendMessage(player, `[infinite_castle] 素材建築の消去失敗: ${error}`);
    } finally {
        reconstructionInProgress = false;
    }
}

function parseSceneryCommandOptions(rawOptions) {
    const result = { density: undefined, seed: undefined };
    for (const token of String(rawOptions ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean)) {
        if (token === "default" || token === "dense") {
            result.density = token;
            continue;
        }
        const seedText = token.startsWith("seed=") ? token.slice(5) : token;
        if (/^-?\d+$/.test(seedText)) {
            result.seed = Number.parseInt(seedText, 10) >>> 0;
            continue;
        }
        throw new Error(`unknown scenery option: ${token}`);
    }
    return result;
}

export async function rebuildSourcePartsSceneryForPlayer(player, rawOptions = "") {
    if (!player) return { ok: false, reason: "missing_player" };
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) {
        safeSendMessage(player, "[infinite_castle] 別の再構築処理が進行中です");
        return { ok: false, reason: "busy" };
    }
    reconstructionInProgress = true;
    try {
        const dimension = player.dimension;
        const plan = restoreDetailedPlan(dimension);
        if (!plan) throw new Error("current source-parts plan could not be restored");
        const options = parseSceneryCommandOptions(rawOptions);
        safeSendMessage(
            player,
            `[infinite_castle] 装飾城郭を再構築します density=${options.density ?? "current/default"}`
        );
        return await ensureSourcePartsScenery(plan, dimension, player, {
            ...options,
            force: true,
        });
    } catch (error) {
        console.warn(`[infinite_castle] manual scenery rebuild failed: ${error?.stack ?? error}`);
        safeSendMessage(player, `[infinite_castle] 装飾城郭の再構築失敗: ${error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        reconstructionInProgress = false;
    }
}

export async function clearSourcePartsSceneryForPlayer(player, rawOptions = "") {
    if (!player) return { ok: false, reason: "missing_player" };
    if (String(rawOptions ?? "").trim().toLowerCase() !== "confirm") {
        safeSendMessage(
            player,
            "[infinite_castle] 装飾だけ消すには /scriptevent infinite_castle:clear_scenery confirm"
        );
        return { ok: false, reason: "confirmation_required" };
    }
    if (reconstructionInProgress || isSourcePartsSceneryInProgress()) {
        safeSendMessage(player, "[infinite_castle] 別の再構築処理が進行中です");
        return { ok: false, reason: "busy" };
    }
    reconstructionInProgress = true;
    try {
        return await clearSourcePartsScenery(player);
    } finally {
        reconstructionInProgress = false;
    }
}
