import { GENERATED_SOURCE_VARIANTS } from "./sourcePartsGeneratedCatalog.js";

const STAIR_VARIANTS = new Map(GENERATED_SOURCE_VARIANTS
    .filter(v => v.category === "stairs" && v.navigationValidated)
    .map(v => [v.id, v]));
const STAIR_DIRECTION = Object.freeze({east:0, west:1, south:2, north:3});

const DIRECTION_VECTOR = Object.freeze({
    north: Object.freeze({ x: 0, y: 0, z: -1 }),
    south: Object.freeze({ x: 0, y: 0, z: 1 }),
    west: Object.freeze({ x: -1, y: 0, z: 0 }),
    east: Object.freeze({ x: 1, y: 0, z: 0 }),
    up: Object.freeze({ x: 0, y: 1, z: 0 }),
    down: Object.freeze({ x: 0, y: -1, z: 0 }),
});

function addScaled(origin, vector, scale) {
    return {
        x: origin.x + vector.x * scale,
        y: origin.y + vector.y * scale,
        z: origin.z + vector.z * scale,
    };
}

function pointKey(point) {
    return `${point.x},${point.y},${point.z}`;
}

function positiveInteger(value, fallback) {
    return Number.isFinite(value) ? Math.max(1, Math.trunc(value)) : fallback;
}

/**
 * Returns a deterministic walk envelope for both authored socket interiors.
 * Socket detection proves the boundary lane, but thick walls, fence rails, and
 * late socket caps can still obstruct the first few blocks inside a structure.
 */
export function createConnectionClearance(connection, options = {}) {
    const depth = positiveInteger(options.depth, 3);
    const requestedHeight = positiveInteger(options.height, 3);
    const openingHeight = positiveInteger(connection?.opening?.height, requestedHeight);
    const height = Math.min(requestedHeight, openingHeight);
    const floorNormal = DIRECTION_VECTOR[connection?.floorNormal];
    if (!floorNormal) throw new Error(`invalid connection floor normal: ${connection?.floorNormal}`);

    const airByKey = new Map();
    const supportByKey = new Map();
    const stairSupportByKey = new Map();
    const sides = [
        { lanes: connection?.fromLanes ?? [], direction: connection?.fromDirection, variantId:connection?.fromVariantId },
        { lanes: connection?.toLanes ?? [], direction: connection?.toDirection, variantId:connection?.toVariantId },
    ];
    for (const side of sides) {
        const outward = DIRECTION_VECTOR[side.direction];
        if (!outward) throw new Error(`invalid connection direction: ${side.direction}`);
        const stair = STAIR_VARIANTS.get(side.variantId);
        let inwardRise = 0;
        let uphillDirection;
        if (stair) {
            const end = stair.sockets.find(s => s.direction === side.direction)?.walkPosition;
            const other = stair.sockets.find(s => s.direction !== side.direction)?.walkPosition;
            const length = end && other ? Math.abs(other.x-end.x)+Math.abs(other.z-end.z) : 0;
            if (connection.floorNormal !== "up" || !length || Math.abs(other.y-end.y) !== length) {
                throw new Error(`invalid stair socket slope: ${side.variantId}`);
            }
            inwardRise = Math.sign(other.y-end.y);
            uphillDirection = Object.keys(STAIR_DIRECTION).find(direction => {
                const vector = DIRECTION_VECTOR[direction];
                return vector.x === -outward.x * inwardRise && vector.z === -outward.z * inwardRise;
            });
        }
        for (const lane of side.lanes) {
            for (let penetration = 0; penetration <= depth; penetration += 1) {
                const foot = addScaled(lane, outward, -penetration);
                // A horizontal tunnel at a stair's low end deletes its first
                // three risers; at its high end it adds a floating plank ledge.
                // Follow the authored one-block-per-cell ascent/descent instead.
                foot.y += inwardRise * penetration;
                const support = addScaled(foot, floorNormal, -1);
                supportByKey.set(
                    pointKey(support), support
                );
                if (stair) stairSupportByKey.set(pointKey(support), {
                    position: support,
                    retainLanding: inwardRise === 1 && penetration === 0,
                    states: {upside_down_bit:false, weirdo_direction:STAIR_DIRECTION[uphillDirection]},
                });
                for (let vertical = 0; vertical < height; vertical += 1) {
                    const point = addScaled(foot, floorNormal, vertical);
                    airByKey.set(pointKey(point), point);
                }
            }
        }
    }
    return {
        depth,
        height,
        air: [...airByKey.values()],
        supports: [...supportByKey.values()],
        stairSupports: [...stairSupportByKey.values()],
    };
}
