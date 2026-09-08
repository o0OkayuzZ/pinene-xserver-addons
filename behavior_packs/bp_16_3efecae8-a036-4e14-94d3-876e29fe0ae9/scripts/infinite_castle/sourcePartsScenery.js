import { BlockVolume, StructureAnimationMode, system, world } from "@minecraft/server";
import { createRebuildStartCue } from "./sourcePartsRebuildFeedback.js";
import { assertVisualTestSafety, isVisualTestObserver } from "./sourcePartsVisualTestGuard.js";
import {
    DEFAULT_SCENERY_DENSITY,
    SCENERY_CORE_CLEARANCE,
    SOURCE_PARTS_SCENERY_SCHEMA_VERSION,
    SOURCE_PARTS_SCENERY_VARIANTS,
    sourcePartsSceneryExpectedCount,
    boundsIntersect,
    createSourcePartsSceneryPlanAsync,
    createSourcePartsSceneryClusterAsync,
    placementBounds,
    sourcePartsSceneryCoreReservations,
} from "./sourcePartsSceneryPlanner.js";
import { clipBoundsToHeight, splitBoundsForFill } from "./sourcePartsVolumes.js";

const SCENERY_STATE_KEY = "infinite_castle:source_parts_scenery_v1";
const STATE_SCHEMA_VERSION = 1;
const DYNAMIC_PROPERTY_STRING_LIMIT = 32767;
const LOAD_MARGIN = 2;
const LOAD_TIMEOUT_TICKS = 400;
const SETTLE_TICKS = 4;
const AMBIENT_CURSOR_KEY = "infinite_castle:scenery_cluster_cursor_v1";
const PLAYER_SAFETY_HORIZONTAL = 6;
const PLAYER_SAFETY_DOWN = 4;
const PLAYER_SAFETY_UP = 6;
const SCENERY_VARIANT_BY_ID = new Map(SOURCE_PARTS_SCENERY_VARIANTS.map(v => [v.id, v]));
let sceneryInProgress = false;

async function waitTicks(ticks) {
    await system.waitTicks(ticks);
    assertVisualTestSafety();
}

function safeSendMessage(player, message) {
    try {
        player?.sendMessage(message);
    } catch {
        // A long scenery build may outlive its requesting player.
    }
}

function integerVector(value) {
    if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)
        || !Number.isFinite(value.z)) return null;
    return { x: Math.trunc(value.x), y: Math.trunc(value.y), z: Math.trunc(value.z) };
}

function positiveSize(value) {
    const result = integerVector(value);
    if (!result || result.x < 1 || result.y < 1 || result.z < 1) return null;
    return result;
}

function compactPlacement(placement) {
    const origin = integerVector(placement?.origin);
    const size = positiveSize(placement?.size);
    if (!origin || !size || typeof placement?.variantId !== "string"
        || typeof placement?.structureId !== "string") return null;
    return {
        placementId: String(placement.placementId ?? "scenery"),
        variantId: placement.variantId,
        structureId: placement.structureId,
        category: String(placement.category ?? "scenery"),
        navigationValidated: placement.navigationValidated === true,
        solidBlockCount: Math.max(0, Math.trunc(placement.solidBlockCount ?? 0)),
        origin,
        size,
    };
}

function compactPlan(plan) {
    const dimensionId = typeof plan?.dimensionId === "string"
        ? plan.dimensionId : plan?.dimension?.id;
    if (plan?.density !== "default" && plan?.density !== "dense") return null;
    const placements = (Array.isArray(plan?.placements) ? plan.placements : [])
        .map(compactPlacement)
        .filter(Boolean);
    const layoutVersion = Number.isFinite(plan.layoutVersion) ? Math.max(0, Math.trunc(plan.layoutVersion))
        : (Number.isFinite(plan.schemaVersion) ? Math.max(0, Math.trunc(plan.schemaVersion)) : 0);
    const expectedCount = sourcePartsSceneryExpectedCount(plan.density, layoutVersion);
    // Dynamic core relocation can deliberately remove only the decorative
    // pieces which collide with the next playable layout.  A partial marker is
    // required so a truncated/corrupt legacy state is not silently accepted.
    const partial = plan?.partial === true;
    const validPlacementCount = partial
        ? placements.length > 0 && placements.length < expectedCount
        : placements.length === expectedCount;
    if (!dimensionId || !validPlacementCount
        || new Set(placements.map((placement) => placement.placementId)).size !== placements.length) {
        return null;
    }
    return {
        dimensionId,
        layoutVersion,
        seed: Number.isFinite(plan.seed) ? plan.seed >>> 0 : 0,
        density: plan.density,
        coreSignature: String(plan.coreSignature ?? "unknown"),
        expectedPlacementCount: expectedCount,
        partial,
        solidBlockCount: placements.reduce(
            (total, placement) => total + placement.solidBlockCount, 0
        ),
        placements,
    };
}

function expectedPlacementCount(density) {
    return sourcePartsSceneryExpectedCount(density);
}

function physicalPlan(plan, placements, nextCoreSignature = undefined) {
    const expected = sourcePartsSceneryExpectedCount(plan.density,
        plan.layoutVersion ?? plan.schemaVersion ?? 0);
    return {
        ...plan,
        placements: placements.slice(),
        coreSignature: nextCoreSignature ?? plan.coreSignature,
        expectedPlacementCount: expected,
        partial: placements.length > 0 && placements.length < expected,
    };
}

function savePhysicalPlan(status, plan, placements, nextCoreSignature = undefined) {
    if (placements.length === 0) {
        saveState("empty", null);
        return null;
    }
    const nextPlan = physicalPlan(plan, placements, nextCoreSignature);
    saveState(status, nextPlan);
    return nextPlan;
}

function serializeState(status, plan) {
    const compact = plan ? compactPlan(plan) : null;
    const serialized = JSON.stringify({
        schemaVersion: STATE_SCHEMA_VERSION,
        status,
        plan: compact,
    });
    if (serialized.length > DYNAMIC_PROPERTY_STRING_LIMIT) {
        throw new Error(
            `scenery state is too large: ${serialized.length}/${DYNAMIC_PROPERTY_STRING_LIMIT}`
        );
    }
    return serialized;
}

function saveState(status, plan) {
    world.setDynamicProperty(SCENERY_STATE_KEY, serializeState(status, plan));
}

function loadState() {
    const raw = world.getDynamicProperty(SCENERY_STATE_KEY);
    if (raw === undefined) {
        return { known: true, present: false, status: "absent", plan: null };
    }
    if (typeof raw !== "string") {
        return { known: false, present: true, status: "invalid", plan: null };
    }
    try {
        const state = JSON.parse(raw);
        if (state?.schemaVersion !== STATE_SCHEMA_VERSION) {
            return { known: false, present: true, status: "unsupported", plan: null };
        }
        if (state.plan === null) {
            return { known: true, present: false, status: state.status ?? "empty", plan: null };
        }
        const plan = compactPlan(state.plan);
        if (!plan || plan.placements.length !== state.plan.placements?.length) {
            return { known: false, present: true, status: "invalid", plan: null };
        }
        return { known: true, present: true, status: state.status ?? "unknown", plan };
    } catch {
        return { known: false, present: true, status: "invalid", plan: null };
    }
}

function fnv1a32(value) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function coreSignature(corePlan) {
    const dimensionId = String(corePlan?.dimensionId ?? "unknown");
    const records = (Array.isArray(corePlan?.placements) ? corePlan.placements : [])
        .map((placement) => {
            const origin = integerVector(placement?.origin) ?? { x: 0, y: 0, z: 0 };
            const size = positiveSize(placement?.size) ?? { x: 0, y: 0, z: 0 };
            return [
                String(placement?.placementId ?? ""),
                String(placement?.variantId ?? placement?.structureId ?? ""),
                origin.x, origin.y, origin.z,
                size.x, size.y, size.z,
            ].join("|");
        })
        .sort();
    const material = [`dimension=${dimensionId}`, ...records].join("\n");
    return `core-v2-fnv1a32:${fnv1a32(material).toString(16).padStart(8, "0")}`
        + `:${records.length}`;
}

function sceneryPlanCompatibleWithCore(sceneryPlan, corePlan) {
    if (!sceneryPlan || !corePlan || sceneryPlan.dimensionId !== corePlan.dimensionId) return false;
    if (sceneryPlan.layoutVersion !== SOURCE_PARTS_SCENERY_SCHEMA_VERSION) return false;
    // Old aggregate-AABB signatures and scenery tied to another exact topology
    // remain clearable, but must not be reused around a newly anchored core.
    if (sceneryPlan.coreSignature !== coreSignature(corePlan)) return false;
    const protectedCorePlacements = sourcePartsSceneryCoreReservations(
        corePlan,
        SCENERY_CORE_CLEARANCE
    ).map((bounds) => ({
        from: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
        to: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    }));
    return sceneryPlan.placements.every((sceneryPlacement) =>
        protectedCorePlacements.every((coreBounds) =>
            !boundsIntersect(coreBounds, placementBounds(sceneryPlacement))
        )
    );
}

function pointInsideBounds(location, bounds, margin = 2) {
    return location.x >= bounds.from.x - margin && location.x <= bounds.to.x + margin
        && location.y >= bounds.from.y - margin && location.y <= bounds.to.y + margin
        && location.z >= bounds.from.z - margin && location.z <= bounds.to.z + margin;
}

function playerSafetyBounds(location) {
    if (!location || !Number.isFinite(location.x) || !Number.isFinite(location.y)
        || !Number.isFinite(location.z)) return null;
    const point = {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
    };
    return {
        from: {
            x: point.x - PLAYER_SAFETY_HORIZONTAL,
            y: point.y - PLAYER_SAFETY_DOWN,
            z: point.z - PLAYER_SAFETY_HORIZONTAL,
        },
        to: {
            x: point.x + PLAYER_SAFETY_HORIZONTAL,
            y: point.y + PLAYER_SAFETY_UP,
            z: point.z + PLAYER_SAFETY_HORIZONTAL,
        },
    };
}

function blockBounds(value) {
    if (value?.from && value?.to) {
        const from = integerVector(value.from);
        const to = integerVector(value.to);
        if (!from || !to) return null;
        return {
            from: {
                x: Math.min(from.x, to.x),
                y: Math.min(from.y, to.y),
                z: Math.min(from.z, to.z),
            },
            to: {
                x: Math.max(from.x, to.x),
                y: Math.max(from.y, to.y),
                z: Math.max(from.z, to.z),
            },
        };
    }
    if ([value?.minX, value?.minY, value?.minZ,
        value?.maxX, value?.maxY, value?.maxZ].every(Number.isFinite)) {
        return {
            from: {
                x: Math.trunc(value.minX),
                y: Math.trunc(value.minY),
                z: Math.trunc(value.minZ),
            },
            to: {
                x: Math.trunc(value.maxX),
                y: Math.trunc(value.maxY),
                z: Math.trunc(value.maxZ),
            },
        };
    }
    return null;
}

function normalizedBounds(values) {
    return (Array.isArray(values) ? values : []).map(blockBounds).filter(Boolean);
}

function liveSafetyBounds(dimension, additional = []) {
    const live = dimension?.getPlayers?.().filter((player) => !isVisualTestObserver(player, dimension)).map((player) =>
        playerSafetyBounds(player.location)
    ).filter(Boolean) ?? [];
    return [...normalizedBounds(additional), ...live];
}

function boundsTouchAny(bounds, exclusions) {
    return exclusions.some((exclusion) => boundsIntersect(bounds, exclusion));
}

function coreReservationBounds(corePlan, clearance = SCENERY_CORE_CLEARANCE) {
    const safeClearance = Number.isFinite(clearance)
        ? Math.max(0, Math.trunc(clearance)) : SCENERY_CORE_CLEARANCE;
    return sourcePartsSceneryCoreReservations(corePlan, safeClearance).map((bounds) => ({
        from: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
        to: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    }));
}

function playersInsidePlacements(dimension, placements) {
    const bounds = placements.map(placementBounds);
    return dimension.getPlayers().filter((player) =>
        bounds.some((current) => pointInsideBounds(player.location, current))
    );
}

function dimensionForPlan(plan, fallback) {
    if (fallback?.id === plan?.dimensionId) return fallback;
    return world.getDimension(plan.dimensionId);
}

function expandedLoadBounds(bounds) {
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

function releaseArea(manager, name) {
    try {
        if (manager?.hasTickingArea(name)) manager.removeTickingArea(name);
    } catch {
        // Removal is intentionally idempotent after interrupted builds.
    }
}

async function waitForArea(manager, name, options) {
    let resolved = false;
    let failure = null;
    const creation = manager.createTickingArea(name, options);
    void creation.then(() => { resolved = true; }, (error) => { failure = error; });
    for (let elapsed = 0; elapsed < LOAD_TIMEOUT_TICKS; elapsed += 1) {
        if (failure) throw failure;
        const area = manager.getTickingArea(name);
        if (resolved || area?.isFullyLoaded === true) return;
        await waitTicks(1);
    }
    throw new Error(`scenery ticking area timed out: ${name}`);
}

async function withLoadedBounds(dimension, bounds, name, callback) {
    assertVisualTestSafety(dimension);
    const manager = world.tickingAreaManager;
    if (!manager) throw new Error("world.tickingAreaManager is unavailable");
    const clipped = clipBoundsToHeight(expandedLoadBounds(bounds), dimension.heightRange);
    if (!clipped) throw new Error(`scenery bounds are outside dimension height: ${name}`);
    const options = { dimension, from: clipped.from, to: clipped.to };
    releaseArea(manager, name);
    if (!manager.hasCapacity(options)) {
        throw new Error(`insufficient ticking area capacity for scenery: ${name}`);
    }
    try {
        await waitForArea(manager, name, options);
        assertVisualTestSafety(dimension);
        return await callback();
    } finally {
        releaseArea(manager, name);
        await waitTicks(1);
    }
}

async function clearPlanBlocks(plan, dimension, player) {
    if (!plan?.placements?.length) return 0;
    const occupants = playersInsidePlacements(dimension, plan.placements);
    const initialSafety = liveSafetyBounds(dimension);
    if (plan.placements.some((placement) =>
        boundsTouchAny(placementBounds(placement), initialSafety))) {
        throw new Error(
            `cannot clear scenery while players are inside it: `
            + occupants.map((occupant) => occupant.name).join(", ")
        );
    }
    saveState("clearing", plan);
    let clearedSections = 0;
    for (let index = 0; index < plan.placements.length; index += 1) {
        const bounds = placementBounds(plan.placements[index]);
        if (boundsTouchAny(bounds, liveSafetyBounds(dimension))) {
            throw new Error(`player safety area entered scenery clear ${index}`);
        }
        await withLoadedBounds(dimension, bounds, `ic_scene_clear_${index}`, async () => {
            for (const section of splitBoundsForFill(bounds)) {
                // Check the whole authored piece, not only this fill section.
                // If a player enters between sections, no later part of that
                // structure is touched and its state remains conservatively
                // reserved for a safe retry.
                if (boundsTouchAny(bounds, liveSafetyBounds(dimension))) {
                    throw new Error(`player safety area entered scenery clear ${index}`);
                }
                dimension.fillBlocks(
                    new BlockVolume(section.from, section.to),
                    "minecraft:air"
                );
                clearedSections += 1;
                await waitTicks(1);
            }
        });
        if ((index + 1) % 6 === 0 || index + 1 === plan.placements.length) {
            safeSendMessage(
                player,
                `[ic-scenery] clear ${index + 1}/${plan.placements.length}`
            );
        }
    }
    return clearedSections;
}

function resolveStructureId(placement, packIds) {
    if (packIds.includes(placement.structureId)) return placement.structureId;
    return packIds.find((id) =>
        id.endsWith(`:generated_variants/${placement.variantId}`)
        || id.endsWith(`/generated_variants/${placement.variantId}`)
        || id.endsWith(`:${placement.variantId}`)
        || id.endsWith(`/${placement.variantId}`)
    ) ?? null;
}

async function placePlanBlocks(plan, dimension, player, options = {}) {
    const packIds = world.structureManager.getPackStructureIds();
    const missing = plan.placements.filter((placement) =>
        !resolveStructureId(placement, packIds)
    );
    if (missing.length > 0) {
        throw new Error(
            `missing scenery variants: ${missing.map((item) => item.variantId).join(", ")}`
        );
    }
    const fixedSafetyBounds = normalizedBounds(options.playerSafetyBounds);
    let physicalPlacements = [];
    let skipped = 0;
    saveState("empty", null);
    for (let index = 0; index < plan.placements.length; index += 1) {
        const placement = plan.placements[index];
        const structureId = resolveStructureId(placement, packIds);
        const bounds = placementBounds(placement);
        if (boundsTouchAny(bounds, liveSafetyBounds(dimension, fixedSafetyBounds))) {
            skipped += 1;
            continue;
        }
        // Journal the complete placement envelope before the atomic structure
        // placement. If the script stops between these operations, a later
        // clear only over-clears air; an untracked structure can never remain.
        const journalPlacements = [...physicalPlacements, placement];
        savePhysicalPlan("building", plan, journalPlacements);
        const placed = await withLoadedBounds(
            dimension,
            bounds,
            `ic_scene_build_${index}`,
            async () => {
                if (boundsTouchAny(
                    bounds,
                    liveSafetyBounds(dimension, fixedSafetyBounds)
                )) return false;
                world.structureManager.place(structureId, dimension, placement.origin, {
                    animationMode: StructureAnimationMode.None,
                    includeBlocks: true,
                    includeEntities: false,
                });
                await waitTicks(SETTLE_TICKS);
                return true;
            }
        );
        if (!placed) {
            skipped += 1;
            savePhysicalPlan("building", plan, physicalPlacements);
            continue;
        }
        physicalPlacements = journalPlacements;
        if ((index + 1) % 4 === 0 || index + 1 === plan.placements.length) {
            safeSendMessage(
                player,
                `[ic-scenery] build ${index + 1}/${plan.placements.length}`
            );
        }
    }
    const partial = physicalPlacements.length !== expectedPlacementCount(plan.density);
    const physical = savePhysicalPlan(
        partial ? "partial" : "complete",
        plan,
        physicalPlacements
    );
    return {
        placed: physicalPlacements.length,
        skipped,
        partial,
        plan: physical,
    };
}

export function isSourcePartsSceneryInProgress() {
    return sceneryInProgress;
}

export function getSourcePartsSceneryGuard(dimensionId) {
    const state = loadState();
    if (!state.known) {
        return { known: false, present: state.present, status: state.status, bounds: [] };
    }
    if (!state.plan || state.plan.dimensionId !== dimensionId) {
        return { known: true, present: false, status: state.status, bounds: [] };
    }
    return {
        known: true,
        present: true,
        status: state.status,
        density: state.plan.density,
        placements: state.plan.placements.length,
        bounds: state.plan.placements.map((placement) => ({
            placementId: placement.placementId,
            ...placementBounds(placement),
        })),
    };
}

/**
 * Pure classification used before choosing/mutating a dynamic core layout.
 * A placement touching a player safety envelope is fixed for this cycle.  All
 * other placements are relocatable, and only relocatable placements whose
 * bounds enter a reserved core envelope need to be evacuated.
 */
export function classifySourcePartsSceneryRelocation(
    sceneryPlan,
    corePlan,
    options = {}
) {
    const placements = Array.isArray(sceneryPlan?.placements)
        ? sceneryPlan.placements : [];
    const safetyBounds = normalizedBounds(options.playerSafetyBounds);
    const reservations = coreReservationBounds(
        corePlan,
        options.clearance ?? SCENERY_CORE_CLEARANCE
    );
    const records = placements.map((placement) => {
        const bounds = placementBounds(placement);
        const protectedByPlayer = boundsTouchAny(bounds, safetyBounds);
        const conflictsWithCore = boundsTouchAny(bounds, reservations);
        return {
            placement,
            placementId: placement.placementId,
            bounds,
            protectedByPlayer,
            conflictsWithCore,
            evacuate: conflictsWithCore && !protectedByPlayer,
            blocked: conflictsWithCore && protectedByPlayer,
        };
    });
    const selectIds = (predicate) => records.filter(predicate).map((item) => item.placementId);
    const selectBounds = (predicate) => records.filter(predicate).map((item) => ({
        placementId: item.placementId,
        ...item.bounds,
    }));
    return {
        placements: records.length,
        safetyBounds,
        reservations,
        protectedPlacementIds: selectIds((item) => item.protectedByPlayer),
        protectedBounds: selectBounds((item) => item.protectedByPlayer),
        conflictingPlacementIds: selectIds((item) => item.conflictsWithCore),
        evacuatePlacementIds: selectIds((item) => item.evacuate),
        blockedPlacementIds: selectIds((item) => item.blocked),
        retainedPlacementIds: selectIds((item) => !item.evacuate),
    };
}

/**
 * Returns only the scenery which must remain fixed while a candidate is
 * selected. Relocatable scenery is intentionally omitted from candidate
 * exclusions; prepareSourcePartsSceneryForDynamicCore removes just the pieces
 * that the selected candidate actually needs.
 */
export function getSourcePartsSceneryRelocationGuard(
    dimensionOrId,
    playerSafetyBoundsOverride = undefined
) {
    const dimension = typeof dimensionOrId === "string" ? null : dimensionOrId;
    const dimensionId = typeof dimensionOrId === "string"
        ? dimensionOrId : dimensionOrId?.id;
    const state = loadState();
    if (!state.known) {
        return {
            known: false,
            present: state.present,
            status: state.status,
            fixedBounds: [],
            relocatableBounds: [],
        };
    }
    if (!state.plan || state.plan.dimensionId !== dimensionId) {
        return {
            known: true,
            present: false,
            status: state.status,
            fixedBounds: [],
            relocatableBounds: [],
        };
    }
    const safety = playerSafetyBoundsOverride === undefined
        ? liveSafetyBounds(dimension)
        : normalizedBounds(playerSafetyBoundsOverride);
    const fixed = [];
    const relocatable = [];
    for (const placement of state.plan.placements) {
        const bounds = {
            placementId: placement.placementId,
            ...placementBounds(placement),
        };
        (boundsTouchAny(bounds, safety) ? fixed : relocatable).push(bounds);
    }
    return {
        known: true,
        present: true,
        status: state.status,
        density: state.plan.density,
        partial: state.plan.partial === true,
        placements: state.plan.placements.length,
        safetyBounds: safety,
        fixedBounds: fixed,
        relocatableBounds: relocatable,
    };
}

export function getSourcePartsSceneryStatus() {
    const state = loadState();
    const rooms = (state.plan?.placements ?? []).filter(p => p.category === "room")
        .map(p => ({placementId:p.placementId, origin:p.origin,
            floorNormal:SCENERY_VARIANT_BY_ID.get(p.variantId)?.floorNormal ?? "unknown"}));
    return {
        known: state.known,
        present: state.present,
        status: state.status,
        density: state.plan?.density ?? "none",
        placements: state.plan?.placements?.length ?? 0,
        expectedPlacements: state.plan?.expectedPlacementCount ?? 0,
        partial: state.plan?.partial === true,
        invertedRooms: rooms.filter(p => p.floorNormal === "down").length,
        sidewaysRooms: rooms.filter(p => !["up", "down", "unknown"].includes(p.floorNormal)).length,
        rooms,
        inProgress: sceneryInProgress,
    };
}

export async function prepareSourcePartsSceneryForCore(corePlan, dimension, player) {
    const state = loadState();
    if (!state.known) {
        throw new Error("stored scenery state is invalid; clear scenery before rebuilding the core");
    }
    if (!state.plan || sceneryPlanCompatibleWithCore(state.plan, corePlan)) {
        return { ok: true, cleared: false, placements: state.plan?.placements.length ?? 0 };
    }
    if (sceneryInProgress) return { ok: false, reason: "busy" };
    sceneryInProgress = true;
    try {
        const sceneryDimension = dimensionForPlan(state.plan, dimension);
        const clearedSections = await clearPlanBlocks(state.plan, sceneryDimension, player);
        saveState("empty", null);
        return { ok: true, cleared: true, clearedSections };
    } finally {
        sceneryInProgress = false;
    }
}

async function clearDynamicSceneryPlacement(
    placement,
    dimension,
    index,
    fixedSafetyBounds
) {
    const bounds = placementBounds(placement);
    let clearedSections = 0;
    let blocked = boundsTouchAny(
        bounds,
        liveSafetyBounds(dimension, fixedSafetyBounds)
    );
    if (blocked) return { complete: false, clearedSections };
    await withLoadedBounds(
        dimension,
        bounds,
        `ic_scene_move_${index}`,
        async () => {
            for (const section of splitBoundsForFill(bounds)) {
                if (boundsTouchAny(
                    bounds,
                    liveSafetyBounds(dimension, fixedSafetyBounds)
                )) {
                    blocked = true;
                    break;
                }
                dimension.fillBlocks(
                    new BlockVolume(section.from, section.to),
                    "minecraft:air"
                );
                clearedSections += 1;
                // A large authored facade is split across ticks so neither its
                // chunk load nor its fills accumulate in one watchdog slice.
                await waitTicks(1);
            }
        }
    );
    return { complete: !blocked, clearedSections };
}

/**
 * Evacuates only stored decorative structures which conflict with a selected
 * dynamic core. Player-protected scenery remains byte-for-byte untouched.
 *
 * Call getSourcePartsSceneryRelocationGuard before candidate selection and use
 * fixedBounds as the candidate scenery exclusions. Then call this function
 * before any playable-core block is cleared or placed.
 */
export async function prepareSourcePartsSceneryForDynamicCore(
    corePlan,
    dimension,
    player,
    options = {}
) {
    if (!corePlan || !dimension) return { ok: false, reason: "invalid_target" };
    if (sceneryInProgress) return { ok: false, reason: "busy" };
    const state = loadState();
    if (!state.known) return { ok: false, reason: "invalid_state" };
    if (!state.plan || state.plan.dimensionId !== dimension.id) {
        return {
            ok: true,
            evacuated: 0,
            retained: 0,
            clearedSections: 0,
            partial: false,
        };
    }

    const fixedSafetyBounds = normalizedBounds(options.playerSafetyBounds);
    const initialSafetyBounds = liveSafetyBounds(dimension, fixedSafetyBounds);
    const classification = classifySourcePartsSceneryRelocation(
        state.plan,
        corePlan,
        {
            clearance: options.clearance ?? SCENERY_CORE_CLEARANCE,
            playerSafetyBounds: initialSafetyBounds,
        }
    );
    if (classification.blockedPlacementIds.length > 0) {
        return {
            ok: false,
            reason: "player_scenery_conflict",
            blockedPlacementIds: classification.blockedPlacementIds,
            fixedBounds: classification.protectedBounds,
            evacuated: 0,
            retained: state.plan.placements.length,
        };
    }

    const evacuationIds = new Set(classification.evacuatePlacementIds);
    if (evacuationIds.size === 0) {
        const nextStatus = state.plan.partial === true ? "dynamic_partial" : "complete";
        savePhysicalPlan(
            nextStatus,
            state.plan,
            state.plan.placements,
            coreSignature(corePlan)
        );
        return {
            ok: true,
            evacuated: 0,
            retained: state.plan.placements.length,
            clearedSections: 0,
            partial: state.plan.partial === true,
        };
    }

    sceneryInProgress = true;
    let retainedPlacements = state.plan.placements.slice();
    let evacuated = 0;
    let clearedSections = 0;
    try {
        const targets = state.plan.placements.filter((placement) =>
            evacuationIds.has(placement.placementId)
        );
        for (let index = 0; index < targets.length; index += 1) {
            const target = targets[index];
            const result = await clearDynamicSceneryPlacement(
                target,
                dimension,
                index,
                fixedSafetyBounds
            );
            clearedSections += result.clearedSections;
            if (!result.complete) {
                // Earlier fully-cleared pieces were journaled after each
                // placement. Keep this possibly-partial placement reserved so
                // a retry can safely clear its complete original envelope.
                savePhysicalPlan(
                    "relocating",
                    state.plan,
                    retainedPlacements
                );
                return {
                    ok: false,
                    reason: "player_scenery_conflict",
                    blockedPlacementIds: [target.placementId],
                    evacuated,
                    retained: retainedPlacements.length,
                    clearedSections,
                    partialMutation: result.clearedSections > 0,
                };
            }
            retainedPlacements = retainedPlacements.filter((placement) =>
                placement.placementId !== target.placementId
            );
            evacuated += 1;
            // Save after a successful clear. A crash before this write merely
            // over-reserves an empty AABB; it can never orphan an untracked
            // decorative structure.
            savePhysicalPlan("relocating", state.plan, retainedPlacements);
            if (evacuated % 3 === 0 || evacuated === targets.length) {
                safeSendMessage(
                    player,
                    `[ic-scenery] relocate ${evacuated}/${targets.length}`
                );
            }
            await waitTicks(1);
        }

        const nextSignature = coreSignature(corePlan);
        const partial = retainedPlacements.length > 0
            && retainedPlacements.length < sourcePartsSceneryExpectedCount(state.plan.density, state.plan.layoutVersion);
        savePhysicalPlan(
            partial ? "dynamic_partial" : "complete",
            state.plan,
            retainedPlacements,
            nextSignature
        );
        return {
            ok: true,
            evacuated,
            retained: retainedPlacements.length,
            clearedSections,
            partial,
            coreSignature: nextSignature,
        };
    } catch (error) {
        console.warn(`[infinite_castle] dynamic scenery relocation failed: ${error?.stack ?? error}`);
        // retainedPlacements is conservative: the current placement is only
        // removed after every one of its fill sections succeeds.
        savePhysicalPlan("relocating", state.plan, retainedPlacements);
        return {
            ok: false,
            reason: "error",
            error: String(error),
            evacuated,
            retained: retainedPlacements.length,
            clearedSections,
        };
    } finally {
        sceneryInProgress = false;
    }
}

/**
 * Rebuilds a complete decorative shell after the dynamic playable core has
 * committed. This is deliberately all-or-defer at preflight: if a current
 * player safety envelope touches either the remaining old scenery or the
 * already-planned target shell, it changes no blocks and lets a later interval
 * retry. Mid-operation player movement is guarded again per authored piece.
 */
export async function replenishSourcePartsSceneryAfterDynamicCore(
    corePlan,
    dimension,
    player,
    options = {}
) {
    if (!corePlan || !dimension) return { ok: false, reason: "invalid_target" };
    if (sceneryInProgress) return { ok: false, reason: "busy" };
    const state = loadState();
    if (!state.known) return { ok: false, reason: "invalid_state" };
    if (state.plan && state.plan.dimensionId !== dimension.id) {
        return { ok: false, reason: "dimension_mismatch" };
    }
    const density = options.density === "dense" || options.density === "default"
        ? options.density
        : (state.plan?.density ?? DEFAULT_SCENERY_DENSITY);
    const seed = Number.isFinite(options.seed)
        ? options.seed >>> 0
        : ((corePlan.seed ?? 0) ^ 0x51ce4e7) >>> 0;

    // Planning and structure-catalog validation happen before the first clear,
    // so an invalid target can never strand the old decorative shell.
    await waitTicks(1);
    let targetPlan;
    try {
        targetPlan = await createSourcePartsSceneryPlanAsync(corePlan, {
            seed,
            density,
            heightRange: dimension.heightRange,
        }, () => waitTicks(1));
        targetPlan.dimensionId = dimension.id;
        targetPlan.coreSignature = coreSignature(corePlan);
    } catch (error) {
        return { ok: false, reason: "planning_error", error: String(error) };
    }
    await waitTicks(1);
    const packIds = world.structureManager.getPackStructureIds();
    const missing = targetPlan.placements.filter((placement) =>
        !resolveStructureId(placement, packIds)
    );
    if (missing.length > 0) {
        return {
            ok: false,
            reason: "missing_variants",
            missing: missing.map((placement) => placement.variantId),
        };
    }

    const initialSafety = liveSafetyBounds(dimension, options.playerSafetyBounds);
    const oldPlacements = state.plan?.dimensionId === dimension.id
        ? state.plan.placements : [];
    const oldBlocked = oldPlacements.filter((placement) =>
        boundsTouchAny(placementBounds(placement), initialSafety)
    );
    const targetBlocked = targetPlan.placements.filter((placement) =>
        boundsTouchAny(placementBounds(placement), initialSafety)
    );
    if (oldBlocked.length > 0 || targetBlocked.length > 0) {
        return {
            ok: true,
            deferred: true,
            reason: "player_safety",
            oldBlockedPlacementIds: oldBlocked.map((placement) => placement.placementId),
            targetBlockedPlacementIds: targetBlocked.map((placement) => placement.placementId),
            retained: oldPlacements.length,
        };
    }

    sceneryInProgress = true;
    try {
        let clearedSections = 0;
        if (oldPlacements.length > 0) {
            clearedSections = await clearPlanBlocks(state.plan, dimension, player);
        }
        saveState("empty", null);
        const placementResult = await placePlanBlocks(
            targetPlan,
            dimension,
            player,
            { playerSafetyBounds: options.playerSafetyBounds }
        );
        return {
            ok: true,
            deferred: false,
            cleared: oldPlacements.length,
            clearedSections,
            placements: placementResult.placed,
            skipped: placementResult.skipped,
            partial: placementResult.partial,
            density,
            seed,
        };
    } catch (error) {
        // clearPlanBlocks keeps the old full/partial envelope journaled until
        // it finishes. placePlanBlocks journals each target before placement.
        // Either interruption therefore leaves a conservative recoverable
        // state instead of untracked blocks.
        console.warn(`[infinite_castle] scenery replenish failed: ${error?.stack ?? error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        sceneryInProgress = false;
    }
}

export async function ensureSourcePartsScenery(
    corePlan,
    dimension,
    player,
    options = {}
) {
    if (sceneryInProgress) return { ok: false, reason: "busy" };
    const state = loadState();
    if (!state.known) return { ok: false, reason: "invalid_state" };
    const density = options.density === "dense" || options.density === "default"
        ? options.density
        : (state.plan?.density ?? DEFAULT_SCENERY_DENSITY);
    if (!options.force && state.status === "complete"
        && state.plan && state.plan.density === density
        && sceneryPlanCompatibleWithCore(state.plan, corePlan)) {
        state.plan.coreSignature = coreSignature(corePlan);
        saveState("complete", state.plan);
        return {
            ok: true,
            reused: true,
            placements: state.plan.placements.length,
            density: state.plan.density,
        };
    }

    sceneryInProgress = true;
    try {
        const seed = Number.isFinite(options.seed)
            ? options.seed >>> 0
            : ((corePlan.seed ?? 0) ^ 0x51ce4e7) >>> 0;
        const plan = options.preparedPlan ?? await createSourcePartsSceneryPlanAsync(corePlan, {
            seed,
            density,
            heightRange: dimension.heightRange,
        }, () => waitTicks(1));
        plan.dimensionId = dimension.id;
        plan.coreSignature = coreSignature(corePlan);
        // Resolve every asset before deleting the previous scene. This matters
        // for newly added variants and for a planner failure at extreme heights.
        const packIds = world.structureManager.getPackStructureIds();
        if (plan.placements.some(p => !resolveStructureId(p, packIds))) {
            throw new Error("scenery preflight: missing generated variants");
        }
        createRebuildStartCue(dimension, {scenery:true, enabled:options.startCue !== false})();
        if (state.plan) {
            await clearPlanBlocks(
                state.plan,
                dimensionForPlan(state.plan, dimension),
                player
            );
        }
        const placementResult = await placePlanBlocks(
            plan,
            dimension,
            player,
            { playerSafetyBounds: options.playerSafetyBounds }
        );
        safeSendMessage(
            player,
            `[infinite_castle] 装飾城郭完成 buildings=${placementResult.placed} `
            + `density=${density} nonNavigable=${plan.nonNavigablePlacements} `
            + `solid=${plan.solidBlockCount} skipped=${placementResult.skipped}`
        );
        return {
            ok: true,
            reused: false,
            placements: placementResult.placed,
            skipped: placementResult.skipped,
            partial: placementResult.partial,
            density,
            nonNavigablePlacements: plan.nonNavigablePlacements,
            solidBlockCount: plan.solidBlockCount,
        };
    } catch (error) {
        console.warn(`[infinite_castle] scenery build failed: ${error?.stack ?? error}`);
        safeSendMessage(player, `[infinite_castle] 装飾城郭の建築失敗: ${error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        sceneryInProgress = false;
    }
}

function ambientClusterIndex(placement) {
    const match = /\.cluster\.(\d+)\./.exec(placement.placementId);
    return match ? Number(match[1]) : -1;
}

export async function rebuildSourcePartsSceneryCluster(corePlan, dimension, player, options = {}) {
    if (dimension?.id !== "infinite_castle:dungeon") return {ok:false, reason:"dimension"};
    if (sceneryInProgress) return {ok:false, reason:"busy"};
    const state = loadState();
    if (!state.known) return {ok:false, reason:"invalid_state"};
    if (state.plan && state.plan.dimensionId !== dimension.id) return {ok:false, reason:"dimension"};
    sceneryInProgress = true;
    const storedCursor = world.getDynamicProperty(AMBIENT_CURSOR_KEY);
    const clusterIndex = (Number.isFinite(storedCursor) ? Math.abs(Math.trunc(storedCursor)) : 0) % 6;
    const oldPlacements = state.plan?.placements ?? [];
    const oldCluster = oldPlacements.filter((placement) => ambientClusterIndex(placement) === clusterIndex);
    const fixed = oldPlacements.filter((placement) => ambientClusterIndex(placement) !== clusterIndex);
    let physical = oldPlacements.slice();
    let metadata = state.plan;
    let cleared = 0;
    let placed = 0;
    const playStartCue = createRebuildStartCue(dimension, {scenery:true});
    const checkpoint = async () => {
        await waitTicks(2);
        if (options.shouldYield?.() || dimension.getPlayers().length === 0) {
            const error = new Error("ambient scenery yielded to core rebuild");
            error.code = "SCENERY_PREEMPT";
            throw error;
        }
    };
    try {
        if (oldCluster.some((placement) => boundsTouchAny(placementBounds(placement), liveSafetyBounds(dimension)))) {
            world.setDynamicProperty(AMBIENT_CURSOR_KEY, (clusterIndex + 1) % 6);
            return {ok:true, deferred:true, reason:"player_safety", clusterIndex};
        }
        const target = await createSourcePartsSceneryClusterAsync(corePlan, {
            seed: options.seed ?? (Date.now() >>> 0), clusterIndex,
            density: state.plan?.density ?? DEFAULT_SCENERY_DENSITY,
            heightRange: dimension.heightRange, fixedPlacements: fixed,
        }, checkpoint);
        if (!target) {
            world.setDynamicProperty(AMBIENT_CURSOR_KEY, (clusterIndex + 1) % 6);
            return {ok:true, deferred:true, reason:"no_site", clusterIndex};
        }
        if ([...target.placements, ...oldCluster].some((placement) =>
            boundsTouchAny(placementBounds(placement), liveSafetyBounds(dimension)))) {
            world.setDynamicProperty(AMBIENT_CURSOR_KEY, (clusterIndex + 1) % 6);
            return {ok:true, deferred:true, reason:"player_safety", clusterIndex};
        }
        const packIds = world.structureManager.getPackStructureIds();
        if (target.placements.some((placement) => !resolveStructureId(placement, packIds))) {
            return {ok:false, reason:"missing_variants"};
        }
        metadata = {...target, coreSignature: coreSignature(corePlan)};
        for (const old of oldCluster) {
            await checkpoint();
            const bounds = placementBounds(old);
            await withLoadedBounds(dimension, bounds, `ic_ambient_clear_${clusterIndex}_${cleared}`, async () => {
                for (const section of splitBoundsForFill(bounds, 4096)) {
                    await checkpoint();
                    if (boundsTouchAny(bounds, liveSafetyBounds(dimension))) {
                        const error = new Error("player entered ambient clear");
                        error.code = "SCENERY_PREEMPT";
                        throw error;
                    }
                    // Keep this entire old envelope journaled until every
                    // section finishes, including if the player moves into it.
                    playStartCue();
                    dimension.fillBlocks(new BlockVolume(section.from, section.to), "minecraft:air");
                }
            });
            physical = physical.filter((placement) => placement.placementId !== old.placementId);
            savePhysicalPlan("ambient_partial", metadata, physical);
            cleared += 1;
        }
        for (const placement of target.placements) {
            await checkpoint();
            const bounds = placementBounds(placement);
            await withLoadedBounds(dimension, bounds, `ic_ambient_build_${clusterIndex}_${placed}`, async () => {
                await checkpoint();
                if (boundsTouchAny(bounds, liveSafetyBounds(dimension))) {
                    const error = new Error("player entered ambient build");
                    error.code = "SCENERY_PREEMPT";
                    throw error;
                }
                // Save before place: an interrupted structure call can never
                // leave untracked decoration for the next core to collide with.
                physical.push(placement);
                savePhysicalPlan("ambient_partial", metadata, physical);
                playStartCue();
                world.structureManager.place(resolveStructureId(placement, packIds), dimension, placement.origin, {
                    animationMode: StructureAnimationMode.None, includeBlocks:true, includeEntities:false,
                });
                placed += 1;
                await waitTicks(12);
            });
        }
        savePhysicalPlan(physical.length === expectedPlacementCount(metadata.density) ? "complete" : "partial", metadata, physical);
        world.setDynamicProperty(AMBIENT_CURSOR_KEY, (clusterIndex + 1) % 6);
        safeSendMessage(player, `[ic-scenery] 自動更新 group=${clusterIndex + 1}/6 placed=${placed} cleared=${cleared}`);
        return {ok:true, clusterIndex, placed, cleared};
    } catch (error) {
        // State already contains exactly the conservative physical envelopes.
        // Retain the cursor so the next cycle fills the interrupted group.
        if (error.code === "SCENERY_PREEMPT") return {ok:true, deferred:true, reason:"priority_or_player", placed, cleared};
        console.warn(`[infinite_castle] ambient scenery failed: ${error?.stack ?? error}`);
        return {ok:false, reason:"error", error:String(error)};
    } finally {
        sceneryInProgress = false;
    }
}

export async function clearSourcePartsScenery(player, dimensionOverride = undefined) {
    if (sceneryInProgress) return { ok: false, reason: "busy" };
    const state = loadState();
    if (!state.known) return { ok: false, reason: "invalid_state" };
    if (!state.plan) {
        saveState("empty", null);
        return { ok: true, placements: 0, clearedSections: 0 };
    }
    let dimension;
    try {
        dimension = dimensionForPlan(state.plan, dimensionOverride);
    } catch {
        return { ok: false, reason: "missing_dimension" };
    }
    sceneryInProgress = true;
    try {
        const clearedSections = await clearPlanBlocks(state.plan, dimension, player);
        saveState("empty", null);
        safeSendMessage(
            player,
            `[infinite_castle] 装飾城郭を消去しました buildings=${state.plan.placements.length}`
        );
        return {
            ok: true,
            placements: state.plan.placements.length,
            clearedSections,
        };
    } catch (error) {
        console.warn(`[infinite_castle] scenery clear failed: ${error?.stack ?? error}`);
        safeSendMessage(player, `[infinite_castle] 装飾城郭の消去失敗: ${error}`);
        return { ok: false, reason: "error", error: String(error) };
    } finally {
        sceneryInProgress = false;
    }
}
