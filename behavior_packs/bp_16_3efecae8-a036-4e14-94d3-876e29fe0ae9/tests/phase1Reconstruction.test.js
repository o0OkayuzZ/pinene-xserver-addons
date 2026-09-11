import test from "node:test";
import assert from "node:assert/strict";
import { createSourcePartsPlan } from "../scripts/infinite_castle/sourcePartsPlanner.js";
import {
    createAnchoredSourcePartsReconstructionAsync,
    createStationarySourcePartsReconstruction,
} from "../scripts/infinite_castle/sourcePartsDynamicReconstruction.js";
import { validateSocketContracts } from "../scripts/infinite_castle/phase1Sockets.js";

test("occupied rooms, crosses and stairs lock only themselves; every stair approach fits", () => {
    for (let seed = 0; seed < 8; seed++) {
        const plan = createSourcePartsPlan(seed, { x: 1000, y: 80, z: 1000 });
        for (const p of plan.placements) {
            const point = {
                x: p.origin.x + p.size.x / 2,
                y: p.origin.y + (p.category === "stairs" ? p.size.y / 2 : 1),
                z: p.origin.z + p.size.z / 2,
            };
            const candidate = createStationarySourcePartsReconstruction(plan, [point], 0, {
                requiredOldPlacementIds: [p.placementId],
            });
            assert.deepEqual(candidate.protectedOldPlacementIds, [p.placementId]);
            validateSocketContracts(plan, plan, [p.placementId], [p.placementId]);
        }
    }
});
test("socket rejection continues asynchronous search without expanding hard locks", async () => {
    const plan = createSourcePartsPlan(42, { x: 1000, y: 80, z: 1000 });
    plan.dimensionId = "infinite_castle:dungeon";
    const p = plan.placements.find((p) => p.category === "room"),
        point = { x: p.origin.x + 21, y: p.origin.y + 1, z: p.origin.z + 21 };
    let yields = 0,
        rejections = 0;
    const candidate = await createAnchoredSourcePartsReconstructionAsync(
        plan,
        [point],
        71,
        { min: -64, max: 512 },
        0,
        {
            validateCandidate: (c) => {
                if (rejections++ === 0) throw new Error("synthetic rejected socket candidate");
                validateSocketContracts(plan, c.plan, c.protectedOldPlacementIds, c.protectedNewPlacementIds);
            },
        },
        async () => {
            yields++;
        },
    );
    assert.equal(candidate.protectedOldPlacementIds.length, 1);
    assert.ok(yields > 1);
    assert.ok(rejections > 1);
    assert.ok(candidate.changedPlacements > 0, "moving layout survives socket guard");
    validateSocketContracts(
        plan,
        candidate.plan,
        candidate.protectedOldPlacementIds,
        candidate.protectedNewPlacementIds,
    );
});
