import { createConnectionClearance } from "./sourcePartsConnectionClearance.js";

const key = (p) => `${p.x},${p.y},${p.z}`;
const local = (p, o) => ({ x: p.x - o.x, y: p.y - o.y, z: p.z - o.z });
export function socketContract(plan, id) {
    const placement = plan.placements.find((p) => p.placementId === id);
    if (!placement) throw new Error(`unknown protected placement ${id}`);
    const sockets = [];
    for (const c of plan.connections)
        for (const side of ["from", "to"])
            if (c[`${side}PlacementId`] === id) {
                const lanes = c[`${side}Lanes`];
                sockets.push({
                    state: "OPEN",
                    direction: c[`${side}Direction`],
                    floorNormal: c.floorNormal,
                    world: c[side],
                    local: local(c[side], placement.origin),
                    width: c.opening.width,
                    height: c.opening.height,
                    lanes: lanes.map(key).sort(),
                    sill: c[side].y - 1,
                });
            }
    for (const s of plan.sealedSockets ?? [])
        if (s.placementId === id) {
            const world = {
                x: s.localPosition.x + placement.origin.x,
                y: s.localPosition.y + placement.origin.y,
                z: s.localPosition.z + placement.origin.z,
            };
            sockets.push({
                state: "SEALED",
                direction: s.direction,
                floorNormal: s.floorNormal,
                world,
                local: s.localPosition,
                width: s.opening.width,
                height: s.opening.height,
                lanes: s.localWalkLanes
                    .map((p) =>
                        key({
                            x: p.x + placement.origin.x,
                            y: p.y + placement.origin.y,
                            z: p.z + placement.origin.z,
                        }),
                    )
                    .sort(),
                sill: world.y - 1,
            });
        }
    return sockets.sort((a, b) => key(a.world).localeCompare(key(b.world)));
}
export function containsPlacement(placement, point) {
    return ["x", "y", "z"].every(
        (a) => point[a] >= placement.origin[a] && point[a] < placement.origin[a] + placement.size[a],
    );
}
function fixedNavigation(plan, placement) {
    const points = new Set();
    for (const c of plan.connections)
        if (c.fromPlacementId === placement.placementId || c.toPlacementId === placement.placementId) {
            const clearance = createConnectionClearance(c);
            for (const point of clearance.air)
                if (containsPlacement(placement, point)) points.add("air:" + key(point));
            for (const point of clearance.supports)
                if (containsPlacement(placement, point)) points.add("support:" + key(point));
            for (const support of clearance.stairSupports)
                if (containsPlacement(placement, support.position))
                    points.add("stair:" + key(support.position) + ":" + JSON.stringify(support.states));
        }
    return JSON.stringify([...points].sort());
}
export function validateSocketContracts(oldPlan, newPlan, oldIds, newIds) {
    for (const id of oldIds) {
        const old = oldPlan.placements.find((p) => p.placementId === id),
            next = newPlan.placements.find(
                (p) =>
                    newIds.includes(p.placementId) &&
                    p.variantId === old.variantId &&
                    key(p.origin) === key(old.origin),
            );
        if (
            !next ||
            JSON.stringify(socketContract(oldPlan, id)) !==
                JSON.stringify(socketContract(newPlan, next.placementId))
        )
            throw new Error(`Hard Lock socket contract changed: ${id}`);
        if (fixedNavigation(oldPlan, old) !== fixedNavigation(newPlan, next))
            throw new Error("Hard Lock navigation footprint changed");
    }
    const protectedIds = new Set(newIds);
    for (const c of newPlan.connections) {
        if (!protectedIds.has(c.fromPlacementId) && !protectedIds.has(c.toPlacementId)) continue;
        const clearance = createConnectionClearance(c, { depth: 3 }); // validates low/high end slope and orientation
        for (const side of ["from", "to"]) {
            const p = newPlan.placements.find((p) => p.placementId === c[`${side}PlacementId`]);
            if (protectedIds.has(p.placementId) || p.category !== "stairs") continue;
            const lanes = c[`${side}Lanes`];
            if (lanes.length !== c.opening.width) throw new Error("stair walk width mismatch");
            const own = createConnectionClearance(
                { ...c, [side === "from" ? "toLanes" : "fromLanes"]: [] },
                { depth: 3 },
            );
            // Open-topped authored stairs end at their highest structure cell.
            // Their two cells of headroom belong to the navigation envelope.
            const envelope = { ...p, size: { ...p.size, y: p.size.y + 2 } };
            if (
                !own.stairSupports.length ||
                own.supports.some((point) => !containsPlacement(p, point)) ||
                own.air.some((point) => !containsPlacement(envelope, point))
            )
                throw new Error("stair clearance does not fit mutable navigation volume");
        }
    }
    return true;
}
