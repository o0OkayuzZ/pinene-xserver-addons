import assert from "node:assert/strict";
import * as mock from "./minecraft-server-encounter-mock.js";
import { createSourcePartsPlan } from "../scripts/infinite_castle/sourcePartsPlanner.js";
import { serializeRoomMaterials } from "../scripts/infinite_castle/sourceRoomMaterials.js";
let api = await import("../scripts/infinite_castle/sourceRoomEncounters.js");
const STATE = "infinite_castle:room_encounters_v1";
const CORE = "infinite_castle:source_parts_test_state_v2";
const PLAN = "infinite_castle:source_parts_detailed_plan_v1";
const plan = createSourcePartsPlan(42, { x: 1000, y: 80, z: 1000 });
plan.dimensionId = mock.dimension.id;
// Override a seeded normal room, just as a garden retained by LOCK would be.
const placement = plan.placements.find(p => p.category === "room" && p.materialTheme === "normal");
placement.materialTheme = "rare";
mock.setup(plan);
const descriptor = { v: 2, d: plan.dimensionId, s: plan.seed, t: plan.style, o: plan.topologyId,
    a: Object.values(plan.tierBases.lower), m: serializeRoomMaterials(plan) };
mock.world.setDynamicProperty(CORE, JSON.stringify({ status: "complete" }));
mock.world.setDynamicProperty(PLAN, JSON.stringify(descriptor));
const state = () => JSON.parse(mock.world.getDynamicProperty(STATE));
const garden = () => state().rooms.find(r => r.origin.x === placement.origin.x && r.origin.z === placement.origin.z && r.origin.y === placement.origin.y);
function tick(count = 1) { for (let i = 0; i < count; i++) { mock.advance(); api.updateRoomEncounters(); } }
function player(id, mode = "Survival") {
    const health = { currentValue: 10, effectiveMax: 20, setCurrentValue(value) { this.currentValue = value; } };
    return { id, health, mode, messages: [], dimension: mock.dimension,
        location: { x: placement.origin.x + 21, y: placement.origin.y + 1, z: placement.origin.z + 21 },
        getGameMode() { return this.mode; }, getComponent() { return health; },
        sendMessage(text) { this.messages.push(text); } };
}
const p = player("one"), p2 = player("two", "Adventure");
mock.setPlayers([p, p2]);
tick();
assert.equal(garden().kind, "healing_garden");
assert.equal(garden().chest, null);
assert.ok(garden().slots.every(s => s.phase === "dead"));
tick(7);
assert.equal(p.health.currentValue, 10); // full two-second interval, no instant entry heal
tick();
assert.equal(p.health.currentValue, 12);
assert.equal(p2.health.currentValue, 12);
assert.equal(p.messages.length, 1);
assert.equal(mock.metrics.spawns, 0);
const inside = { ...p.location };
p.location = { ...inside, x: placement.origin.x + 40 };
tick(8);
assert.equal(p.health.currentValue, 12); // no lingering effect outside the garden
p.location = inside;
tick();
assert.equal(p.health.currentValue, 14);
p.location = { ...inside, x: placement.origin.x + 40 }; tick(); p.location = inside; tick();
assert.equal(p.health.currentValue, 14); // boundary hopping cannot reset the cooldown
p.health.currentValue = 19;
tick(8);
assert.equal(p.health.currentValue, 20);
p.health.currentValue = 0;
tick(8);
assert.equal(p.health.currentValue, 0); // never resurrect a dead player
p.health.currentValue = 10; p.mode = "Creative";
tick(8);
assert.equal(p.health.currentValue, 10);
p.mode = "Survival";
mock.world.setDynamicProperty(CORE, JSON.stringify({ status: "building" }));
tick(8);
assert.equal(p.health.currentValue, 10);
mock.world.setDynamicProperty(CORE, JSON.stringify({ status: "complete" }));
// Saved material overrides, rather than a fresh rarity roll, decide the kind.
mock.resetSubscriptions();
api = await import("../scripts/infinite_castle/sourceRoomEncounters.js?reload=garden");
tick(10);
assert.equal(garden().kind, "healing_garden");
assert.equal(mock.metrics.spawns, 0);
assert.ok(p.health.currentValue > 10);

// Migrate an existing combat ledger with valuable contents into a garden.
const saved = state();
const old = saved.rooms.find(r => r.key === garden().key);
old.kind = "combat"; old.keyDefeated = false; old.reward = "locked";
old.chest = { x: old.origin.x + 11, y: old.origin.y + 1, z: old.origin.z + 11 };
old.chestOwned = true;
const block = mock.dimension.getBlock(old.chest); block.setType("minecraft:chest");
const container = block.getComponent().container;
container.setItem(0, new mock.ItemStack("minecraft:diamond", 7));
const enemy = mock.dimension.spawnEntity("minecraft:zombie", { ...inside });
enemy.addTag("ic_room_enemy_v1"); enemy.addTag(old.slots[0].tag);
old.slots[0].phase = "alive"; old.slots[0].id = enemy.id;
mock.world.setDynamicProperty(STATE, JSON.stringify(saved));
mock.resetSubscriptions();
api = await import("../scripts/infinite_castle/sourceRoomEncounters.js?reload=migration");
const stockBefore = mock.metrics.stockWrites;
tick(2);
assert.equal(garden().kind, "healing_garden");
assert.equal(container.getItem(0).amount, 7);
assert.equal(mock.metrics.stockWrites, stockBefore);
assert.ok(!mock.allEntities().includes(enemy));
const interaction = { block, player: p };
mock.emit("interact", interaction);
assert.notEqual(interaction.cancel, true);

// Ordinary rooms still produce their original shared encounter.
const ordinary = state().rooms.find(r => r.kind === "combat");
p.location = { x: ordinary.origin.x + 21, y: ordinary.origin.y + 1, z: ordinary.origin.z + 21 };
mock.setPlayers([p]);
tick(30);
assert.equal(mock.allEntities().filter(e => e.hasTag("ic_room_enemy_v1")).length, 3);
assert.ok(state().rooms.find(r => r.key === ordinary.key).chestOwned);
console.log("HEALING_GARDEN_OK: timing, bounds, multiplayer, max health, death, mutation, reload, migration, ordinary combat");
