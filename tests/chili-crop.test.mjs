import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BP = path.join(ROOT, "behavior_packs", "bp_18_7e540260-69ce-4a82-951d-bc793e151cd5");
const RP = path.join(ROOT, "resource_packs", "rp_21_c81a6798-b6b1-4716-a514-c49967ad0ee2");
const BSL = path.join(ROOT, "behavior_packs", "bp_01_423276b9-02f5-4082-911a-c631a2d83d12");
const json = (p) => JSON.parse(readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

test("chili item is the planting item and only targets farmland", () => {
  const item = json(path.join(BP, "items", "chili_pepper.json"))["minecraft:item"];
  assert.equal(item.description.identifier, "pine:chili_pepper");
  const placer = item.components["minecraft:block_placer"];
  assert.equal(placer.block, "pine:chili_crop");
  assert.deepEqual(placer.use_on, ["minecraft:farmland"]);
});

test("crop exposes four visual growth stages and stays lightweight", () => {
  const block = json(path.join(BP, "blocks", "chili_crop.json"))["minecraft:block"];
  assert.deepEqual(block.description.states["pine:age"], [0, 1, 2, 3]);
  assert.equal(block.components["minecraft:geometry"].identifier, "minecraft:geometry.cross");
  assert.equal(block.components["minecraft:collision_box"], false);
  assert.ok(block.components["pine:chili_crop_logic"]);
  assert.deepEqual(block.components["minecraft:tick"].interval_range, [1200, 2400]);
  assert.equal(block.components["minecraft:material_instances"]["*"].texture, "chili_crop_0");
  assert.deepEqual(
    block.permutations.map((p) => p.components["minecraft:material_instances"]["*"].texture),
    ["chili_crop_1", "chili_crop_2", "chili_crop_3"],
  );
});

test("harvest contract is 2-4 peppers and regrows from age 1; bone meal is wired", () => {
  const source = readFileSync(path.join(BP, "scripts", "chili_crop.js"), "utf8");
  assert.match(source, /const MAX_AGE = 3;/);
  assert.match(source, /const REGROW_AGE = 1;/);
  assert.match(source, /const amount = 2 \+ Math\.floor\(Math\.random\(\) \* 3\);/);
  assert.match(source, /minecraft:bone_meal/);
  assert.match(source, /registerCustomComponent\(COMPONENT_ID/);
  const loot = json(path.join(BP, "loot_tables", "blocks", "chili_crop.json"));
  const entry = loot.pools[0].entries[0];
  assert.equal(entry.name, "pine:chili_pepper");
});

test("all implementation textures are 64x64 PNG and registered", () => {
  const itemAtlas = json(path.join(RP, "textures", "item_texture.json"));
  const terrain = json(path.join(RP, "textures", "terrain_texture.json"));
  assert.equal(itemAtlas.texture_data.chili_pepper.textures, "textures/items/chili_pepper");
  for (let age = 0; age <= 3; age++) {
    assert.equal(terrain.texture_data[`chili_crop_${age}`].textures, `textures/blocks/chili_crop_${age}`);
  }
  const files = [
    path.join(RP, "textures", "items", "chili_pepper.png"),
    ...Array.from({ length: 4 }, (_, age) => path.join(RP, "textures", "blocks", `chili_crop_${age}.png`)),
  ];
  for (const file of files) {
    const png = readFileSync(file);
    assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
    assert.equal(png.readUInt32BE(16), 64);
    assert.equal(png.readUInt32BE(20), 64);
  }
});

test("Infinite Castle includes one chili draw with tiered low chest targets", () => {
  const expected = {
    guard: 0.02,
    curse: 0.02,
    wraith: 0.02,
    heavy: 0.02,
    mixed: 0.02,
    elite: 0.04,
    treasure_vault: 0.06,
  };
  const audit = json(path.join(ROOT, "docs", "bsl", "castle-v4-probabilities.json"));
  for (const [kind, target] of Object.entries(expected)) {
    const table = json(path.join(BSL, "loot_tables", "chests", "infinite_castle", "slots", `${kind}_v4.json`));
    const hits = table.pools[0].entries.filter((entry) => entry.name === "pine:chili_pepper");
    assert.equal(hits.length, 1, kind);
    assert.equal(hits[0].type, "item");
    assert.equal(hits[0].functions, undefined);
    assert.equal(audit[kind].rare.chili_pepper.target, target);
    assert.ok(Math.abs(audit[kind].rare.chili_pepper.actual - target) < 0.0001);
  }
});
