import assert from "node:assert/strict";
import * as mock from "./minecraft-server-encounter-mock.js";
import { createSourcePartsPlan } from "../scripts/infinite_castle/sourcePartsPlanner.js";
import { serializeRoomMaterials, restoreRoomMaterials, materialVariantId } from "../scripts/infinite_castle/sourceRoomMaterials.js";
let api = await import("../scripts/infinite_castle/sourceRoomEncounters.js");
const STATE = "infinite_castle:room_encounters_v1", CORE = "infinite_castle:source_parts_test_state_v2";
const PLAN = "infinite_castle:source_parts_detailed_plan_v1";
const plan = createSourcePartsPlan(42, { x: 1000, y: 80, z: 1000 });
plan.dimensionId = mock.dimension.id;
const room = plan.placements.find(p => p.category === "room");
room.materialTheme = "rare"; room.rareRoomType = "treasure_vault";
mock.setup(plan);
const descriptor = { v: 2, d: plan.dimensionId, s: plan.seed, t: plan.style, o: plan.topologyId,
    a: Object.values(plan.tierBases.lower), m: serializeRoomMaterials(plan) };
mock.world.setDynamicProperty(CORE, JSON.stringify({ status: "complete" }));
mock.world.setDynamicProperty(PLAN, JSON.stringify(descriptor));
const player = { id: "p", dimension: mock.dimension,
    location: { x: room.origin.x + 21, y: room.origin.y + 1, z: room.origin.z + 21 },
    getGameMode() { return "Survival"; }, sendMessage() {},
    getComponent() { throw new Error("vault must not heal"); } };
mock.setPlayers([player, { ...player, id: "second" }]);
const state = () => JSON.parse(mock.world.getDynamicProperty(STATE));
const vault = () => state().rooms.find(r => r.key.startsWith(`${room.variantId}@${room.origin.x},${room.origin.y},${room.origin.z}`));
function tick(n = 1) { for (let i = 0; i < n; i++) { mock.advance(); api.updateRoomEncounters(); } }
tick();
assert.equal(vault().kind, "treasure_vault");
assert.equal(vault().reward, "stocked");
const block = mock.dimension.getBlock(vault().chest);
const container = block.getComponent().container;
assert.deepEqual([0, 1, 2, 3].map(i => [container.getItem(i).typeId, container.getItem(i).amount]), [
    ["minecraft:diamond", 3], ["minecraft:emerald", 8], ["minecraft:gold_ingot", 12], ["minecraft:enchanted_book", 1],
]);
assert.equal(container.getItem(3).enchantments[0].type.id, "unbreaking");
assert.equal(container.getItem(3).enchantments[0].level, 3);
const interaction = { player, block }; mock.emit("interact", interaction);
assert.notEqual(interaction.cancel, true);
tick(20);
assert.equal(mock.metrics.spawns, 0);
const writes = mock.metrics.stockWrites;
container.clearAll(); tick(10);
api.activateRoomEncounterPlan(plan); tick(5);
assert.equal(mock.metrics.stockWrites, writes); // same room retained through reconstruction
mock.resetSubscriptions();
api = await import("../scripts/infinite_castle/sourceRoomEncounters.js?reload=vault");
tick(10);
assert.equal(mock.metrics.stockWrites, writes);
assert.equal(vault().kind, "treasure_vault");
block.setType("minecraft:air"); tick();
assert.equal(block.typeId, "minecraft:chest");
assert.equal(block.getComponent().container.getItem(0), undefined); // repair does not refill
assert.equal(mock.metrics.stockWrites, writes);
const interrupted = state();
interrupted.rooms.find(r => r.key === vault().key).reward = "stocking";
mock.world.setDynamicProperty(STATE, JSON.stringify(interrupted));
mock.resetSubscriptions();
api = await import("../scripts/infinite_castle/sourceRoomEncounters.js?reload=interrupted");
tick();
assert.equal(vault().reward, "stocked");
assert.equal(mock.metrics.stockWrites, writes);

// Actual reconstruction retires the old generation before clearing it. A new
// room at the same coordinates must receive a fresh reward exactly once.
const previousGeneration = vault().generation;
const removedChest = { ...vault().chest };
api.prepareRoomEncounterRemoval(mock.dimension, { from: removedChest, to: removedChest });
block.setType("minecraft:air");
api.activateRoomEncounterPlan(plan);
tick();
assert.ok(vault().generation > previousGeneration);
assert.equal(vault().reward, "stocked");
assert.equal(mock.metrics.stockWrites, writes + 4);
tick(10);
assert.equal(mock.metrics.stockWrites, writes + 4);

// Old two-column saves predate the subtype: their rare rooms stay gardens.
const legacy = descriptor.m.map(entry => entry.slice(0, 2));
restoreRoomMaterials(plan, legacy);
assert.equal(room.rareRoomType, "healing_garden");
assert.ok(materialVariantId(room).endsWith("_rare_garden"));
restoreRoomMaterials(plan, descriptor.m);
assert.equal(room.rareRoomType, "treasure_vault");
assert.ok(materialVariantId(room).endsWith("_rare_vault"));
assert.throws(() => restoreRoomMaterials(plan, [[room.placementId, "rare", "unknown"]]));
let gardens = 0, vaults = 0;
for (let seed = 0; seed < 200; seed++) {
    for (const p of createSourcePartsPlan(seed, { x: 1000, y: 80, z: 1000 }).placements) {
        if (p.materialTheme !== "rare") continue;
        if (p.rareRoomType === "treasure_vault") vaults++; else gardens++;
    }
}
assert.ok(gardens > 0 && vaults > 0);
assert.ok(vaults / (gardens + vaults) > 0.3 && vaults / (gardens + vaults) < 0.7);
console.log(`TREASURE_VAULT_OK: loot, book, multiplayer, no enemies/healing, no refill, repair, crash recovery, migration; gardens=${gardens} vaults=${vaults}`);
