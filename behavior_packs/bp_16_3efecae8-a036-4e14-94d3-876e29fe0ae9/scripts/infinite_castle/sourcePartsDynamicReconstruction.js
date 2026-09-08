import {
    createSourcePartsPlan,
    sourcePartsTopologyIds,
} from "./sourcePartsPlanner.js";
import { fitPlanToHeightRange, translateSourcePartsPlan } from "./sourcePartsVolumes.js";
import { createConnectionClearance } from "./sourcePartsConnectionClearance.js";
import { sourcePartsSceneryCoreReservations } from "./sourcePartsSceneryPlanner.js";

const LAYOUT_STYLES = Object.freeze(["castle", "floating"]);
const CATEGORY_PRIORITY = Object.freeze({ room: 0, crossroads: 1, bridge: 2, stairs: 3 });
const PLAYABLE_CATEGORIES = new Set(["room", "crossroads", "bridge", "stairs"]);

function samePoint(left, right) {
    return left?.x === right?.x && left?.y === right?.y && left?.z === right?.z;
}

function placementVolume(placement) {
    return placement.size.x * placement.size.y * placement.size.z;
}

function seededOrder(items, seed, salt = 0) {
    let state = (seed ^ Math.imul(salt + 1, 0x9e3779b1)) >>> 0;
    const result = items.slice();
    for (let index = result.length - 1; index > 0; index -= 1) {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        const swapIndex = (state >>> 0) % (index + 1);
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
    }
    return result;
}

export function sourcePlacementContainsLocation(placement, location, margin = 0) {
    if (!placement?.origin || !placement?.size || !location) return false;
    return location.x >= placement.origin.x - margin
        && location.x < placement.origin.x + placement.size.x + margin
        && location.y >= placement.origin.y - margin
        && location.y < placement.origin.y + placement.size.y + margin
        && location.z >= placement.origin.z - margin
        && location.z < placement.origin.z + placement.size.z + margin;
}

function playablePlacement(placement) {
    return placement?.navigationValidated === true
        && PLAYABLE_CATEGORIES.has(placement.category);
}

function sortedPlayablePlacements(placements) {
    return placements.slice().sort((left, right) =>
        (CATEGORY_PRIORITY[left.category] ?? 9) - (CATEGORY_PRIORITY[right.category] ?? 9)
        || placementVolume(left) - placementVolume(right)
        || String(left.placementId).localeCompare(String(right.placementId))
    );
}

function connectionLaneNearLocation(connection, location) {
    if (!location) return false;
    const blockLocation = {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
    };
    const lanePoints = [
        connection?.from,
        connection?.to,
        ...(connection?.fromLanes ?? []),
        ...(connection?.toLanes ?? []),
    ].filter((point) => point
        && Number.isFinite(point.x)
        && Number.isFinite(point.y)
        && Number.isFinite(point.z));
    return lanePoints.some((point) =>
        Math.abs(blockLocation.x - point.x) <= 1
        && blockLocation.y >= point.y - 1
        && blockLocation.y <= point.y + 2
        && Math.abs(blockLocation.z - point.z) <= 1
    );
}

function playablePlacementsAtLocation(plan, location, margin = 0) {
    const playable = (plan?.placements ?? []).filter(playablePlacement);
    const containing = sortedPlayablePlacements(playable.filter((placement) =>
        sourcePlacementContainsLocation(placement, location, margin)
    ));
    if (containing.length > 0) return [containing[0]];

    const byId = new Map(playable.map((placement) => [placement.placementId, placement]));
    const lanePlacements = new Map();
    for (const connection of plan?.connections ?? []) {
        if (!connectionLaneNearLocation(connection, location)) continue;
        for (const placementId of [connection.fromPlacementId, connection.toPlacementId]) {
            const placement = byId.get(placementId);
            if (placement) lanePlacements.set(placementId, placement);
        }
    }
    return sortedPlayablePlacements([...lanePlacements.values()]);
}

function sceneryBoundsContainLocation(bounds, location, margin = 0) {
    if (!validExclusionBounds(bounds) || !location) return false;
    return location.x >= bounds.from.x - margin && location.x < bounds.to.x + 1 + margin
        && location.y >= bounds.from.y - margin && location.y < bounds.to.y + 1 + margin
        && location.z >= bounds.from.z - margin && location.z < bounds.to.z + 1 + margin;
}

function validLocation(location) {
    return location
        && Number.isFinite(location.x)
        && Number.isFinite(location.y)
        && Number.isFinite(location.z);
}

/**
 * Classifies player positions without consulting the live world.  Only authored,
 * navigation-validated core pieces (plus their connected seam lanes) are core.
 * Decorative structure envelopes are scenery; every other valid position is
 * outside.  A core/scenery overlap is kept separate as a fail-closed conflict.
 *
 * If core players exist they alone anchor reconstruction.  When everyone is in
 * scenery, one representative location is deliberately retained so the existing
 * nearest-core fallback can choose a stable authored anchor while every scenery
 * envelope remains protected by the reconstruction exclusion guard.
 */
export function classifySourcePlayerLocations(
    plan,
    locations,
    sceneryBounds = [],
    coreMargin = 2
) {
    const validSceneryBounds = (Array.isArray(sceneryBounds) ? sceneryBounds : [])
        .filter(validExclusionBounds);
    const safeCoreMargin = Number.isFinite(coreMargin)
        ? Math.max(0, Math.trunc(coreMargin)) : 2;
    const entries = (Array.isArray(locations) ? locations : []).map((location) => {
        if (!validLocation(location)) {
            return {
                location,
                kind: "invalid",
                placementIds: [],
                sceneryPlacementId: null,
            };
        }
        const corePlacements = playablePlacementsAtLocation(plan, location, safeCoreMargin);
        const scenery = validSceneryBounds.find((bounds) =>
            sceneryBoundsContainLocation(bounds, location, safeCoreMargin)
        );
        // A valid scenery plan never overlaps the playable core.  Keep a broken
        // invariant distinct from a legitimate exterior position.
        const kind = corePlacements.length > 0 && scenery
            ? "conflict"
            : (corePlacements.length > 0 ? "core" : (scenery ? "scenery" : "outside"));
        return {
            location,
            kind,
            placementIds: corePlacements.map((placement) => placement.placementId),
            sceneryPlacementId: scenery?.placementId ?? null,
        };
    });
    const core = entries.filter((entry) => entry.kind === "core");
    const scenery = entries.filter((entry) => entry.kind === "scenery");
    const outside = entries.filter((entry) => entry.kind === "outside");
    const conflict = entries.filter((entry) => entry.kind === "conflict");
    const invalid = entries.filter((entry) => entry.kind === "invalid");
    const blocked = conflict.length > 0 || invalid.length > 0;
    const anchorEntries = blocked
        ? []
        : (core.length > 0 ? core : (scenery.length > 0 ? scenery.slice(0, 1) : outside.slice(0, 1)));
    return {
        entries,
        core,
        scenery,
        outside,
        conflict,
        invalid,
        // Compatibility for callers that used unknown to mean an unsafe state.
        // Legitimate exterior positions are deliberately not included.
        unknown: [...conflict, ...invalid],
        anchorLocations: anchorEntries.map((entry) => entry.location),
        anchorMode: blocked
            ? "none"
            : (core.length > 0
                ? "core"
                : (scenery.length > 0 ? "scenery" : (outside.length > 0 ? "outside" : "none"))),
    };
}

/** Inclusive safety envelope around a player's feet and body. */
export function sourcePlayerSafetyBounds(
    location,
    horizontal = 6,
    verticalDown = 4,
    verticalUp = 6
) {
    if (!validLocation(location)) return null;
    const xz = Number.isFinite(horizontal) ? Math.max(0, Math.trunc(horizontal)) : 6;
    const down = Number.isFinite(verticalDown) ? Math.max(0, Math.trunc(verticalDown)) : 4;
    const up = Number.isFinite(verticalUp) ? Math.max(0, Math.trunc(verticalUp)) : 6;
    const feet = {
        x: Math.floor(location.x),
        y: Math.floor(location.y),
        z: Math.floor(location.z),
    };
    return {
        from: { x: feet.x - xz, y: feet.y - down, z: feet.z - xz },
        to: { x: feet.x + xz, y: feet.y + up, z: feet.z + xz },
    };
}

function nearestPlacement(plan, location) {
    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (const placement of (plan?.placements ?? []).filter(playablePlacement)) {
        const center = {
            x: placement.origin.x + placement.size.x / 2,
            y: placement.origin.y + placement.size.y / 2,
            z: placement.origin.z + placement.size.z / 2,
        };
        const distance = (center.x - location.x) ** 2
            + (center.y - location.y) ** 2
            + (center.z - location.z) ** 2;
        if (distance < bestDistance) {
            best = placement;
            bestDistance = distance;
        }
    }
    return best;
}

export function occupiedSourcePlacements(plan, locations) {
    const selected = new Map();
    for (const location of locations ?? []) {
        const direct = playablePlacementsAtLocation(plan, location);
        if (direct.length > 0) {
            for (const placement of direct) selected.set(placement.placementId, placement);
            continue;
        }
        const nearest = nearestPlacement(plan, location);
        if (nearest) selected.set(nearest.placementId, nearest);
    }
    return [...selected.values()];
}

export function connectedSourcePlacements(plan, placements, hops = 1) {
    const byId = new Map((plan?.placements ?? []).map((placement) => [
        placement.placementId,
        placement,
    ]));
    const expandedIds = new Set((placements ?? []).map((placement) => placement.placementId));
    let frontier = new Set(expandedIds);
    const hopCount = Math.max(0, Math.trunc(hops));
    for (let hop = 0; hop < hopCount && frontier.size > 0; hop += 1) {
        const next = new Set();
        for (const connection of plan?.connections ?? []) {
            const fromId = connection.fromPlacementId;
            const toId = connection.toPlacementId;
            if (frontier.has(fromId) && !expandedIds.has(toId)) next.add(toId);
            if (frontier.has(toId) && !expandedIds.has(fromId)) next.add(fromId);
        }
        for (const placementId of next) expandedIds.add(placementId);
        frontier = next;
    }
    return [...expandedIds]
        .map((placementId) => byId.get(placementId))
        .filter(Boolean);
}

export function adjacentSourcePlacements(plan, placements) {
    return connectedSourcePlacements(plan, placements, 1);
}

function planAt(seed, style, topology, anchor, dimensionId, heightRange) {
    const plan = createSourcePartsPlan(seed, anchor, { style, topology });
    plan.dimensionId = dimensionId;
    fitPlanToHeightRange(plan, heightRange);
    return plan;
}

function exactCandidateMatches(candidate, protectedOld) {
    const available = candidate.placements.slice();
    const matched = [];
    for (const oldPlacement of protectedOld) {
        const index = available.findIndex((placement) =>
            placement.variantId === oldPlacement.variantId
            && samePoint(placement.origin, oldPlacement.origin)
            && samePoint(placement.size, oldPlacement.size)
        );
        if (index < 0) return null;
        matched.push(available[index]);
        available.splice(index, 1);
    }
    return matched;
}

function changedPlacementCount(oldPlan, candidate) {
    const oldSignatures = new Set((oldPlan.placements ?? []).map((placement) =>
        `${placement.variantId}@${placement.origin.x},${placement.origin.y},${placement.origin.z}`
    ));
    return (candidate.placements ?? []).filter((placement) =>
        !oldSignatures.has(
            `${placement.variantId}@${placement.origin.x},${placement.origin.y},${placement.origin.z}`
        )
    ).length;
}

function planPlacementBounds(placement) {
    if (!placement?.origin || !placement?.size) {
        throw new Error("cannot bound an invalid source-parts placement");
    }
    return {
        from: {
            x: placement.origin.x,
            y: placement.origin.y,
            z: placement.origin.z,
        },
        to: {
            x: placement.origin.x + placement.size.x - 1,
            y: placement.origin.y + placement.size.y - 1,
            z: placement.origin.z + placement.size.z - 1,
        },
    };
}

function boundsIntersect(left, right) {
    return left.from.x <= right.to.x && right.from.x <= left.to.x
        && left.from.y <= right.to.y && right.from.y <= left.to.y
        && left.from.z <= right.to.z && right.from.z <= left.to.z;
}

function validExclusionBounds(bounds) {
    return bounds?.from && bounds?.to
        && [bounds.from.x, bounds.from.y, bounds.from.z,
            bounds.to.x, bounds.to.y, bounds.to.z].every(Number.isFinite);
}

function pointBounds(point) {
    return { from: { ...point }, to: { ...point } };
}

function connectionMutationPoints(connection) {
    if (connection?.mode !== "authored_seam") return [];
    let clearance = { air: [], supports: [] };
    try {
        clearance = createConnectionClearance(connection);
    } catch {
        // Invalid connections are rejected by the planner/runtime.  Keeping the
        // raw authored points here still makes the safety scan fail conservatively.
    }
    return [
        ...(connection.fromCarve ?? []),
        ...(connection.toCarve ?? []),
        ...(connection.fromLanes ?? []),
        ...(connection.toLanes ?? []),
        ...(clearance.air ?? []),
        ...(clearance.supports ?? []),
    ].filter(validLocation);
}

function sealedSocketMutationPoints(plan, sealed) {
    const placement = (plan?.placements ?? []).find((candidate) =>
        candidate.placementId === sealed?.placementId
    );
    if (!placement) return [];
    return (sealed.localWalkLanes ?? []).map((point) => ({
        x: placement.origin.x + point.x,
        y: placement.origin.y + point.y,
        z: placement.origin.z + point.z,
    })).filter(validLocation);
}

/**
 * Returns every old placement that must remain whole because a player safety
 * envelope touches the structure itself or one of its seam/socket mutations.
 */
export function sourcePlacementsIntersectingBounds(plan, boundsList) {
    const exclusions = (Array.isArray(boundsList) ? boundsList : [])
        .filter(validExclusionBounds);
    if (exclusions.length === 0) return [];
    const ids = new Set();
    for (const placement of plan?.placements ?? []) {
        const bounds = planPlacementBounds(placement);
        if (exclusions.some((exclusion) => boundsIntersect(bounds, exclusion))) {
            ids.add(placement.placementId);
        }
    }
    for (const connection of plan?.connections ?? []) {
        const touches = connectionMutationPoints(connection).some((point) =>
            exclusions.some((exclusion) => boundsIntersect(pointBounds(point), exclusion))
        );
        if (!touches) continue;
        ids.add(connection.fromPlacementId);
        ids.add(connection.toPlacementId);
    }
    for (const sealed of plan?.sealedSockets ?? []) {
        const touches = sealedSocketMutationPoints(plan, sealed).some((point) =>
            exclusions.some((exclusion) => boundsIntersect(pointBounds(point), exclusion))
        );
        if (touches) ids.add(sealed.placementId);
    }
    const byId = new Map((plan?.placements ?? []).map((placement) => [
        placement.placementId,
        placement,
    ]));
    return [...ids].map((placementId) => byId.get(placementId)).filter(Boolean);
}

function candidateAvoidsExclusions(candidate, exclusions, clearance) {
    if (exclusions.length === 0) return true;
    // Decorative infill is intentionally allowed inside the castle's aggregate
    // envelope. Use the same per-structure and authored-connection reservations
    // as scenery relocation so a player-protected decorative piece cannot make
    // the selected candidate fail only after the search has already finished.
    const coreReservations = sourcePartsSceneryCoreReservations(
        candidate.plan,
        clearance
    ).map((bounds) => ({
        from: { x: bounds.minX, y: bounds.minY, z: bounds.minZ },
        to: { x: bounds.maxX, y: bounds.maxY, z: bounds.maxZ },
    }));
    return coreReservations.every((coreBounds) =>
        exclusions.every((sceneryBounds) => !boundsIntersect(coreBounds, sceneryBounds))
    );
}

function candidateMutationBounds(candidate) {
    const protectedIds = new Set(candidate.protectedNewPlacementIds ?? []);
    const result = (candidate.plan?.placements ?? [])
        .filter((placement) => !protectedIds.has(placement.placementId))
        .map(planPlacementBounds);
    for (const connection of candidate.plan?.connections ?? []) {
        if (protectedIds.has(connection.fromPlacementId)
            && protectedIds.has(connection.toPlacementId)) continue;
        for (const point of connectionMutationPoints(connection)) result.push(pointBounds(point));
    }
    for (const sealed of candidate.plan?.sealedSockets ?? []) {
        if (protectedIds.has(sealed.placementId)) continue;
        for (const point of sealedSocketMutationPoints(candidate.plan, sealed)) {
            result.push(pointBounds(point));
        }
    }
    return result;
}

function candidateAvoidsPlayerExclusions(candidate, exclusions) {
    if (exclusions.length === 0) return true;
    return candidateMutationBounds(candidate).every((mutationBounds) =>
        exclusions.every((playerBounds) => !boundsIntersect(mutationBounds, playerBounds))
    );
}

function protectedOldPlacements(oldPlan, locations, protectionHops, requiredIds = []) {
    const occupied = occupiedSourcePlacements(oldPlan, locations);
    const occupiedAndNeighbours = connectedSourcePlacements(
        oldPlan,
        occupied,
        protectionHops
    );
    const required = new Set(requiredIds ?? []);
    const explicitlyRequired = (oldPlan?.placements ?? []).filter((placement) =>
        required.has(placement.placementId)
    );
    // Safety-touching pieces must remain whole, but expanding every one of them
    // by another graph hop quickly freezes most of a crowded multiplayer plan.
    // Only actual anchor occupants receive the requested neighbour protection.
    const unique = new Map([...occupiedAndNeighbours, ...explicitlyRequired].map((placement) => [
        placement.placementId,
        placement,
    ]));
    return [...unique.values()];
}

function guardCandidate(candidate, options) {
    const sceneryExclusions = (Array.isArray(options.sceneryExclusionBounds)
        ? options.sceneryExclusionBounds
        : (Array.isArray(options.exclusionBounds) ? options.exclusionBounds : []))
        .filter(validExclusionBounds);
    const sceneryClearanceValue = options.sceneryExclusionClearance
        ?? options.exclusionClearance;
    const sceneryClearance = Number.isFinite(sceneryClearanceValue)
        ? Math.max(0, Math.trunc(sceneryClearanceValue)) : 0;
    if (!candidateAvoidsExclusions(candidate, sceneryExclusions, sceneryClearance)) {
        const error = new Error(
            `no anchored reconstruction candidate keeps ${sceneryClearance} blocks from scenery`
        );
        error.code = "SCENERY_GUARD";
        throw error;
    }
    const playerExclusions = (Array.isArray(options.playerExclusionBounds)
        ? options.playerExclusionBounds : []).filter(validExclusionBounds);
    if (!candidateAvoidsPlayerExclusions(candidate, playerExclusions)) {
        const error = new Error("anchored reconstruction candidate enters a player safety area");
        error.code = "PLAYER_GUARD";
        throw error;
    }
    return candidate;
}

/**
 * Re-anchors a complete validated three-tier plan around every occupied piece.
 * The primary occupied piece may become a different compatible node in the new
 * topology, which makes the surrounding castle move while the player's authored
 * structure remains byte-for-byte in place.
 */
export function createAnchoredSourcePartsReconstruction(
    oldPlan,
    locations,
    seed,
    heightRange,
    protectionHops = 1,
    options = {}
) {
    const protectedOld = protectedOldPlacements(
        oldPlan,
        locations,
        protectionHops,
        options.requiredOldPlacementIds
    );
    if (protectedOld.length === 0) {
        throw new Error("dynamic reconstruction needs at least one occupied source placement");
    }
    const primary = protectedOld[0];
    const styles = seededOrder(LAYOUT_STYLES, seed, 1);
    const candidates = [];

    for (const style of styles) {
        const topologies = seededOrder(
            sourcePartsTopologyIds(style), seed, style === "castle" ? 2 : 3
        );
        for (let topologyIndex = 0; topologyIndex < topologies.length; topologyIndex += 1) {
            const topology = topologies[topologyIndex];
            const prototype = createSourcePartsPlan(
                seed, { x: 0, y: 0, z: 0 }, { style, topology }
            );
            const targets = seededOrder(
                prototype.placements.filter((placement) =>
                    placement.variantId === primary.variantId
                ),
                seed,
                11 + topologyIndex
            );
            for (const target of targets) {
                const anchor = {
                    x: primary.origin.x - target.origin.x,
                    y: primary.origin.y - target.origin.y,
                    z: primary.origin.z - target.origin.z,
                };
                let candidate;
                try {
                    candidate = planAt(
                        seed, style, topology, anchor, oldPlan.dimensionId, heightRange
                    );
                } catch {
                    continue;
                }
                const matched = exactCandidateMatches(candidate, protectedOld);
                if (!matched) continue;
                candidates.push({
                    plan: candidate,
                    protectedOldPlacementIds: protectedOld.map(
                        (placement) => placement.placementId
                    ),
                    protectedNewPlacementIds: matched.map(
                        (placement) => placement.placementId
                    ),
                    changedPlacements: changedPlacementCount(oldPlan, candidate),
                    anchorPlacementId: primary.placementId,
                    anchorTargetPlacementId: matched[0].placementId,
                });
            }
        }
    }

    if (candidates.length === 0) {
        throw new Error("no validated plan can preserve all occupied source placements");
    }
    let sceneryRejected = 0;
    let playerRejected = 0;
    const safeCandidates = [];
    for (const candidate of candidates) {
        try {
            safeCandidates.push(guardCandidate(candidate, options));
        } catch (error) {
            if (error?.code === "SCENERY_GUARD") sceneryRejected += 1;
            else if (error?.code === "PLAYER_GUARD") playerRejected += 1;
            else throw error;
        }
    }
    if (safeCandidates.length === 0) {
        const error = new Error(
            playerRejected > 0
                ? "no anchored reconstruction candidate avoids every player safety area"
                : "no anchored reconstruction candidate keeps clear of scenery"
        );
        error.code = playerRejected > 0 ? "PLAYER_GUARD" : "SCENERY_GUARD";
        error.candidateCount = candidates.length;
        error.sceneryRejected = sceneryRejected;
        error.playerRejected = playerRejected;
        throw error;
    }
    const maxChanged = Math.max(...safeCandidates.map((candidate) =>
        candidate.changedPlacements
    ));
    const best = safeCandidates.filter((candidate) =>
        candidate.changedPlacements === maxChanged
    );
    return best[(seed >>> 0) % best.length];
}

/**
 * Bedrock-runtime variant of the anchored search.  The synchronous export above
 * remains useful for offline audits, but a live server must not evaluate every
 * complete-plan target in one tick. This version yields before each expensive
 * planner call, returns immediately when every mutable placement moves, and
 * otherwise keeps the safe candidate with the largest visible change.
 */
export async function createAnchoredSourcePartsReconstructionAsync(
    oldPlan,
    locations,
    seed,
    heightRange,
    protectionHops = 1,
    options = {},
    yieldControl = async () => {}
) {
    const protectedOld = protectedOldPlacements(
        oldPlan,
        locations,
        protectionHops,
        options.requiredOldPlacementIds
    );
    if (protectedOld.length === 0) {
        throw new Error("dynamic reconstruction needs at least one occupied source placement");
    }
    const primary = protectedOld[0];
    const styles = seededOrder(LAYOUT_STYLES, seed, 1);
    let exactCandidates = 0;
    let sceneryRejected = 0;
    let playerRejected = 0;
    let bestSafe = null;

    for (const style of styles) {
        const topologies = seededOrder(
            sourcePartsTopologyIds(style), seed, style === "castle" ? 2 : 3
        );
        for (let topologyIndex = 0; topologyIndex < topologies.length; topologyIndex += 1) {
            const topology = topologies[topologyIndex];
            await yieldControl();
            let prototype;
            try {
                prototype = createSourcePartsPlan(
                    seed, { x: 0, y: 0, z: 0 }, { style, topology }
                );
            } catch {
                // Exported topology definitions are validated offline. If a
                // stale catalog removes one, keep searching other definitions.
                continue;
            }
            const targets = seededOrder(
                prototype.placements.filter((placement) =>
                    placement.variantId === primary.variantId
                ),
                seed,
                11 + topologyIndex
            );
            for (const target of targets) {
                // Preserve a tick boundary for each candidate and its guards,
                // even though translating the validated prototype is cheaper.
                await yieldControl();
                const anchor = {
                    x: primary.origin.x - target.origin.x,
                    y: primary.origin.y - target.origin.y,
                    z: primary.origin.z - target.origin.z,
                };
                let candidatePlan;
                try {
                    candidatePlan = translateSourcePartsPlan(prototype, anchor);
                    candidatePlan.dimensionId = oldPlan.dimensionId;
                    fitPlanToHeightRange(candidatePlan, heightRange);
                } catch {
                    continue;
                }
                const matched = exactCandidateMatches(candidatePlan, protectedOld);
                if (!matched) continue;
                exactCandidates += 1;
                const candidate = {
                    plan: candidatePlan,
                    protectedOldPlacementIds: protectedOld.map(
                        (placement) => placement.placementId
                    ),
                    protectedNewPlacementIds: matched.map(
                        (placement) => placement.placementId
                    ),
                    changedPlacements: changedPlacementCount(oldPlan, candidatePlan),
                    anchorPlacementId: primary.placementId,
                    anchorTargetPlacementId: matched[0].placementId,
                };
                try {
                    const safeCandidate = guardCandidate(candidate, options);
                    const mutableCount = candidatePlan.placements.length - matched.length;
                    if (safeCandidate.changedPlacements >= mutableCount) return safeCandidate;
                    if (!bestSafe
                        || safeCandidate.changedPlacements > bestSafe.changedPlacements) {
                        bestSafe = safeCandidate;
                    }
                } catch (error) {
                    if (error?.code === "SCENERY_GUARD") sceneryRejected += 1;
                    else if (error?.code === "PLAYER_GUARD") playerRejected += 1;
                    else throw error;
                }
            }
        }
    }

    if (bestSafe) return bestSafe;
    if (exactCandidates === 0) {
        throw new Error("no validated plan can preserve all occupied source placements");
    }
    const error = new Error(
        playerRejected > 0
            ? "no anchored reconstruction candidate avoids every player safety area"
            : "no anchored reconstruction candidate keeps clear of scenery"
    );
    error.code = playerRejected > 0 ? "PLAYER_GUARD" : "SCENERY_GUARD";
    error.candidateCount = exactCandidates;
    error.sceneryRejected = sceneryRejected;
    error.playerRejected = playerRejected;
    throw error;
}

/**
 * Last-resort no-topology-change candidate.  Mutable structures are still
 * rebuilt, but the persisted layout remains identical, so a crowded multiplayer
 * session never needs to be rejected merely because exact re-anchoring ran out
 * of combinations.
 */
export function createStationarySourcePartsReconstruction(
    oldPlan,
    locations,
    protectionHops = 1,
    options = {}
) {
    const protectedOld = protectedOldPlacements(
        oldPlan,
        locations,
        protectionHops,
        options.requiredOldPlacementIds
    );
    if (protectedOld.length === 0) {
        throw new Error("stationary reconstruction needs at least one protected source placement");
    }
    const protectedIds = protectedOld.map((placement) => placement.placementId);
    return guardCandidate({
        plan: oldPlan,
        protectedOldPlacementIds: protectedIds,
        protectedNewPlacementIds: protectedIds,
        changedPlacements: 0,
        anchorPlacementId: protectedOld[0].placementId,
        anchorTargetPlacementId: protectedOld[0].placementId,
        stationaryFallback: true,
    }, options);
}

export function restoreSourcePartsPlanFromRoomSnapshot(snapshot, heightRange) {
    if (!snapshot?.dimensionId || !Array.isArray(snapshot.rooms) || snapshot.rooms.length === 0) {
        return null;
    }
    const seed = Number.isFinite(snapshot.seed) ? snapshot.seed >>> 0 : 0;
    for (const style of LAYOUT_STYLES) {
        for (const topology of sourcePartsTopologyIds(style)) {
            let prototype;
            try {
                prototype = createSourcePartsPlan(
                    seed, { x: 0, y: 0, z: 0 }, { style, topology }
                );
            } catch {
                continue;
            }
            const reference = snapshot.rooms[0];
            const prototypePlacement = prototype.placements.find((placement) =>
                placement.placementId === reference.placementId
            );
            if (!prototypePlacement) continue;
            const anchor = {
                x: reference.bounds.minX - prototypePlacement.origin.x,
                y: reference.bounds.minY - prototypePlacement.origin.y,
                z: reference.bounds.minZ - prototypePlacement.origin.z,
            };
            let plan;
            try {
                plan = planAt(
                    seed, style, topology, anchor, snapshot.dimensionId, heightRange
                );
            } catch {
                continue;
            }
            const matches = snapshot.rooms.every((room) => {
                const placement = plan.placements.find((candidate) =>
                    candidate.placementId === room.placementId
                );
                return placement
                    && placement.origin.x === room.bounds.minX
                    && placement.origin.y === room.bounds.minY
                    && placement.origin.z === room.bounds.minZ;
            });
            if (matches) return plan;
        }
    }
    return null;
}
